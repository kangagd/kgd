import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Helper: detect timestamp field dynamically
async function detectTimestampField(base44, entityName) {
  try {
    const sample = await base44.asServiceRole.entities[entityName].list(undefined, 1);
    if (sample.length === 0) return null;
    const record = sample[0];
    const candidates = ['updated_at', 'updated_date', 'created_at', 'created_date', 'createdAt', 'createdDate'];
    for (const field of candidates) {
      if (record[field]) return field;
    }
    return null;
  } catch (err) {
    return null;
  }
}

// Helper: try entity name candidates and return first with records
async function findEntity(base44, candidates) {
  for (const name of candidates) {
    try {
      const records = await base44.asServiceRole.entities[name].list(undefined, 1);
      if (records.length > 0) {
        const timestampField = await detectTimestampField(base44, name);
        return { name, timestampField };
      }
    } catch (err) {
      // try next candidate
    }
  }
  return null;
}

// Helper: filter records by last N days, fallback to last N records
async function getRecentRecords(base44, entityName, days = 30, fallbackLimit = 200) {
  const timestampField = await detectTimestampField(base44, entityName);
  if (!timestampField) {
    // No date field; just fetch recent records by limit
    return await base44.asServiceRole.entities[entityName].list(undefined, fallbackLimit);
  }
  
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  try {
    return await base44.asServiceRole.entities[entityName].filter({
      [timestampField]: { $gte: cutoffDate }
    });
  } catch (err) {
    // Fallback to recent records if filter fails
    return await base44.asServiceRole.entities[entityName].list(undefined, fallbackLimit);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const runAt = new Date().toISOString();
    const allIssues = [];
    const modules = {};

    // ==========================================
    // INVENTORY AUDIT
    // ==========================================
    try {
      const moduleIssues = [];
      const movements = await getRecentRecords(base44, 'StockMovement', 7);

      const badMovements = movements.filter(m => !m.idempotency_key || !m.source);
      badMovements.forEach(m => {
        moduleIssues.push({
          severity: 'critical',
          module: 'inventory',
          check: 'stock_movement_integrity',
          message: `StockMovement ${m.id} missing ${!m.idempotency_key ? 'idempotency_key' : 'source'}`,
          evidence: { movement_id: m.id, created: m.created_date }
        });
      });

      const transfersNullDest = movements.filter(m => m.source === 'transfer' && !m.to_location_id);
      transfersNullDest.forEach(m => {
        moduleIssues.push({
          severity: transfersNullDest.length > 5 ? 'critical' : 'warning',
          module: 'inventory',
          check: 'transfer_completeness',
          message: `Transfer movement ${m.id} missing destination location`,
          evidence: { movement_id: m.id }
        });
      });

      const noSkuMovements = movements.filter(m => !m.item_sku && m.source !== 'job_usage');
      if (noSkuMovements.length > 0) {
        moduleIssues.push({
          severity: 'warning',
          module: 'inventory',
          check: 'sku_preservation',
          message: `${noSkuMovements.length} movements missing item_sku (durable identity)`,
          evidence: { count: noSkuMovements.length, samples: noSkuMovements.slice(0, 3).map(m => m.id) }
        });
      }

      // Orphan InventoryQuantity checks
      const quantities = await base44.asServiceRole.entities.InventoryQuantity.list();
      const priceItems = await base44.asServiceRole.entities.PriceListItem.list();
      const priceItemIds = new Set(priceItems.map(p => p.id));

      const orphanedQties = quantities.filter(q => !priceItemIds.has(q.price_list_item_id));
      if (orphanedQties.length > 0) {
        moduleIssues.push({
          severity: orphanedQties.length > 10 ? 'warning' : 'info',
          module: 'inventory',
          check: 'orphaned_quantities',
          message: `${orphanedQties.length} InventoryQuantity records reference deleted PriceListItems`,
          evidence: { count: orphanedQties.length, samples: orphanedQties.slice(0, 3).map(q => q.id) }
        });
      }

      const invalidSources = movements.filter(m => !['transfer', 'job_usage'].includes(m.source));
      if (invalidSources.length > 0) {
        moduleIssues.push({
          severity: 'warning',
          module: 'inventory',
          check: 'function_regression',
          message: `${invalidSources.length} movements with invalid source values`,
          evidence: { samples: invalidSources.slice(0, 5).map(m => ({ id: m.id, source: m.source })) }
        });
      }

      modules.inventory = {
        checks_run: 5,
        entity: 'StockMovement',
        records_checked: movements.length,
        issues: moduleIssues.filter(i => i.module === 'inventory'),
        summary: `${movements.length} movements checked (last 7d), ${badMovements.length} critical issues`
      };
      allIssues.push(...moduleIssues);
    } catch (err) {
      modules.inventory = { error: err.message };
    }

    // ==========================================
    // PURCHASE ORDERS AUDIT
    // ==========================================
    try {
      const moduleIssues = [];
      const poLineCandidates = ['PurchaseOrderLine', 'POLine', 'PurchaseOrderItem', 'PurchaseOrderLineItem'];
      const poEntity = await findEntity(base44, poLineCandidates) || { name: 'PurchaseOrderLine', timestampField: 'updated_date' };
      const poLines = await getRecentRecords(base44, poEntity.name, 14);

      const noStatus = poLines.filter(l => !l.status);
      noStatus.forEach(l => {
        moduleIssues.push({
          severity: 'warning',
          module: 'purchase_orders',
          check: 'po_line_status',
          message: `PurchaseOrderLine ${l.id} missing status`,
          evidence: { line_id: l.id }
        });
      });

      const validStatuses = ['pending', 'on_order', 'in_transit', 'in_loading_bay', 'at_supplier', 'in_storage', 'in_vehicle', 'installed', 'cancelled'];
      const invalidStatus = poLines.filter(l => l.status && !validStatuses.includes(l.status));
      invalidStatus.forEach(l => {
        moduleIssues.push({
          severity: 'warning',
          module: 'purchase_orders',
          check: 'po_status_enum',
          message: `PurchaseOrderLine ${l.id} has invalid status: ${l.status}`,
          evidence: { line_id: l.id, status: l.status }
        });
      });

      // Check for receive regressions
      const receiveMovements = await base44.asServiceRole.entities.StockMovement.filter({
        source: 'po_receive',
        created_date: { $gte: last14Days.toISOString() }
      });
      const noFromLoc = receiveMovements.filter(m => !m.from_location_id);
      if (noFromLoc.length > 0) {
        moduleIssues.push({
          severity: 'warning',
          module: 'purchase_orders',
          check: 'receive_source_location',
          message: `${noFromLoc.length} PO receive movements missing source location`,
          evidence: { count: noFromLoc.length, samples: noFromLoc.slice(0, 3).map(m => m.id) }
        });
      }

      modules.purchase_orders = {
        checks_run: 4,
        issues: moduleIssues.filter(i => i.module === 'purchase_orders'),
        summary: `${poLines.length} PO lines checked (last 14d), ${noStatus.length + invalidStatus.length} status issues`
      };
      allIssues.push(...moduleIssues);
    } catch (err) {
      modules.purchase_orders = { error: err.message };
    }

    // ==========================================
    // PARTS AUDIT
    // ==========================================
    try {
      const moduleIssues = [];
      const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const parts = await base44.asServiceRole.entities.Part.filter({
        updated_date: { $gte: last30Days.toISOString() }
      });

      const missingPrimaryPO = parts.filter(p => p.purchase_order_ids?.length > 0 && !p.primary_purchase_order_id);
      if (missingPrimaryPO.length > 0) {
        moduleIssues.push({
          severity: 'warning',
          module: 'parts',
          check: 'primary_po_designation',
          message: `${missingPrimaryPO.length} parts have PO references but no primary designated`,
          evidence: { count: missingPrimaryPO.length, samples: missingPrimaryPO.slice(0, 3).map(p => p.id) }
        });
      }

      const terminalStates = ['installed', 'cancelled'];
      const terminalParts = parts.filter(p => terminalStates.includes(p.status));
      if (terminalParts.length > 0) {
        moduleIssues.push({
          severity: 'info',
          module: 'parts',
          check: 'terminal_state_sync',
          message: `${terminalParts.length} parts in terminal states (installed/cancelled)`,
          evidence: { count: terminalParts.length }
        });
      }

      modules.parts = {
        checks_run: 3,
        issues: moduleIssues.filter(i => i.module === 'parts'),
        summary: `${parts.length} parts checked (last 30d), ${missingPrimaryPO.length} primary PO issues`
      };
      allIssues.push(...moduleIssues);
    } catch (err) {
      modules.parts = { error: err.message };
    }

    // ==========================================
    // EMAILS AUDIT (Regression Detection)
    // ==========================================
    try {
      const moduleIssues = [];
      const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // 1) Check EmailDraft image_urls structure (array-of-objects regression = CRITICAL)
      const drafts = await base44.asServiceRole.entities.EmailDraft.filter({
        created_date: { $gte: last30Days.toISOString() }
      });

      const badImageDrafts = drafts.filter(d => {
        if (!d.image_urls || !Array.isArray(d.image_urls)) return false;
        return d.image_urls.some(img => typeof img === 'object');
      });

      if (badImageDrafts.length > 0) {
        moduleIssues.push({
          severity: 'critical',
          module: 'emails',
          check: 'image_upload_regression',
          message: `${badImageDrafts.length} drafts have malformed image_urls (object instead of string)`,
          evidence: { count: badImageDrafts.length, samples: badImageDrafts.slice(0, 2).map(d => ({ id: d.id, image_count: d.image_urls.length })) },
          recommended_fix: 'Run emailImageUrlsMigration to convert objects back to strings'
        });
      }

      // 2) Check for mojibake (encoding regression)
      const messages = await base44.asServiceRole.entities.EmailMessage.filter({
        created_date: { $gte: last30Days.toISOString() }
      });

      const mojibakePattern = /[â€¢â€œâ€™â¯]/;
      const mojibakeMessages = messages.filter(m => {
        const body = m.body_text || m.body_html || '';
        return mojibakePattern.test(body);
      });

      if (mojibakeMessages.length > 0) {
        moduleIssues.push({
          severity: 'warning',
          module: 'emails',
          check: 'encoding_regression',
          message: `${mojibakeMessages.length} messages contain mojibake patterns (encoding corruption)`,
          evidence: { count: mojibakeMessages.length, samples: mojibakeMessages.slice(0, 3).map(m => m.id) },
          recommended_fix: 'Review email sync encoding logic (UTF-8 mismatch)'
        });
      }

      // 3) Assignment regression: check if all recent assignments are to self
      const threads = await base44.asServiceRole.entities.EmailThread.filter({
        assigned_at: { $gte: last30Days.toISOString() }
      });

      const selfAssigned = threads.filter(t => t.assigned_to === t.created_by);
      const assignmentRate = threads.length > 0 ? selfAssigned.length / threads.length : 0;

      if (threads.length > 10 && assignmentRate > 0.8) {
        moduleIssues.push({
          severity: 'warning',
          module: 'emails',
          check: 'assignment_regression',
          message: `${Math.round(assignmentRate * 100)}% of recent thread assignments are to self (possible UI regression)`,
          evidence: { self_assigned: selfAssigned.length, total: threads.length }
        });
      }

      // 4) Thread linking regression
      const orphanThreads = threads.filter(t => !t.project_id && !t.contract_id);
      if (orphanThreads.length > threads.length * 0.5 && threads.length > 20) {
        moduleIssues.push({
          severity: 'info',
          module: 'emails',
          check: 'thread_linking_status',
          message: `${orphanThreads.length} recent threads are not linked to projects/contracts (informational)`,
          evidence: { unlinked: orphanThreads.length, total: threads.length }
        });
      }

      modules.emails = {
        checks_run: 4,
        issues: moduleIssues.filter(i => i.module === 'emails'),
        summary: `${drafts.length} drafts, ${messages.length} messages checked (last 30d), ${badImageDrafts.length} critical image issues`
      };
      allIssues.push(...moduleIssues);
    } catch (err) {
      modules.emails = { error: err.message };
    }

    // ==========================================
    // PROJECTS AUDIT
    // ==========================================
    try {
      const moduleIssues = [];
      const projects = await base44.asServiceRole.entities.Project.list();

      const validStatuses = ['Lead', 'Initial Site Visit', 'Create Quote', 'Quote Sent', 'Quote Approved', 'Final Measure', 'Parts Ordered', 'Scheduled', 'Completed', 'Warranty', 'Lost'];
      const invalidStatus = projects.filter(p => p.status && !validStatuses.includes(p.status));

      if (invalidStatus.length > 0) {
        moduleIssues.push({
          severity: 'warning',
          module: 'projects',
          check: 'project_status_enum',
          message: `${invalidStatus.length} projects have invalid status values`,
          evidence: { samples: invalidStatus.slice(0, 3).map(p => ({ id: p.id, status: p.status })) }
        });
      }

      modules.projects = {
        checks_run: 2,
        issues: moduleIssues.filter(i => i.module === 'projects'),
        summary: `${projects.length} projects checked, ${invalidStatus.length} status issues`
      };
      allIssues.push(...moduleIssues);
    } catch (err) {
      modules.projects = { error: err.message };
    }

    // ==========================================
    // JOBS / VISITS AUDIT
    // ==========================================
    try {
      const moduleIssues = [];
      const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const visits = await base44.asServiceRole.entities.Visit.filter({
        created_date: { $gte: last30Days.toISOString() }
      });

      if (visits.length > 0) {
        const draftVisits = visits.filter(v => v.status === 'draft');
        const draftRate = draftVisits.length / visits.length;

        if (draftRate > 0.8) {
          moduleIssues.push({
            severity: 'warning',
            module: 'jobs_visits',
            check: 'visit_draft_inflation',
            message: `${Math.round(draftRate * 100)}% of recent visits are in draft status (${draftVisits.length}/${visits.length})`,
            evidence: { draft: draftVisits.length, total: visits.length }
          });
        }
      }

      modules.jobs_visits = {
        checks_run: 2,
        issues: moduleIssues.filter(i => i.module === 'jobs_visits'),
        summary: `${visits.length} visits checked (last 30d)`
      };
      allIssues.push(...moduleIssues);
    } catch (err) {
      modules.jobs_visits = { error: err.message };
    }

    // ==========================================
    // TASKS AUDIT
    // ==========================================
    try {
      const moduleIssues = [];
      const tasks = await base44.asServiceRole.entities.Task.list();

      const validStatuses = ['Open', 'In Progress', 'Completed', 'Cancelled'];
      const invalidStatus = tasks.filter(t => t.status && !validStatuses.includes(t.status));

      if (invalidStatus.length > 0) {
        moduleIssues.push({
          severity: 'warning',
          module: 'tasks',
          check: 'task_status_enum',
          message: `${invalidStatus.length} tasks have invalid status values`,
          evidence: { samples: invalidStatus.slice(0, 3).map(t => t.id) }
        });
      }

      modules.tasks = {
        checks_run: 1,
        issues: moduleIssues.filter(i => i.module === 'tasks'),
        summary: `${tasks.length} tasks checked, ${invalidStatus.length} status issues`
      };
      allIssues.push(...moduleIssues);
    } catch (err) {
      modules.tasks = { error: err.message };
    }

    // ==========================================
    // AI JOB BRIEF AUDIT
    // ==========================================
    try {
      const moduleIssues = [];
      const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const jobs = await base44.asServiceRole.entities.Job.filter({
        job_brief_last_generated_at: { $gte: last30Days.toISOString() }
      });

      const noJobTypes = jobs.filter(j => !j.job_type);
      if (noJobTypes.length > 0) {
        moduleIssues.push({
          severity: 'warning',
          module: 'ai_job_brief',
          check: 'job_type_availability',
          message: `${noJobTypes.length} jobs missing job_type (required for brief generation)`,
          evidence: { count: noJobTypes.length, samples: noJobTypes.slice(0, 3).map(j => j.id) }
        });
      }

      const noBrief = jobs.filter(j => !j.job_brief);
      if (noBrief.length > jobs.length * 0.3) {
        moduleIssues.push({
          severity: 'info',
          module: 'ai_job_brief',
          check: 'brief_generation_status',
          message: `${noBrief.length}/${jobs.length} jobs with generated timestamps lack brief content`,
          evidence: { empty: noBrief.length, total: jobs.length }
        });
      }

      modules.ai_job_brief = {
        checks_run: 2,
        issues: moduleIssues.filter(i => i.module === 'ai_job_brief'),
        summary: `${jobs.length} jobs with recent briefs checked`
      };
      allIssues.push(...moduleIssues);
    } catch (err) {
      modules.ai_job_brief = { error: err.message };
    }

    // ==========================================
    // AUTH / RLS AUDIT
    // ==========================================
    try {
      const moduleIssues = [];
      const users = await base44.asServiceRole.entities.User.list();

      const managers = users.filter(u => u.extended_role === 'manager');
      if (managers.length === 0 && users.some(u => u.role === 'user')) {
        moduleIssues.push({
          severity: 'info',
          module: 'auth_rls',
          check: 'manager_role_adoption',
          message: 'No manager-role users configured (informational)',
          evidence: { total_users: users.length }
        });
      }

      modules.auth_rls = {
        checks_run: 2,
        issues: moduleIssues.filter(i => i.module === 'auth_rls'),
        summary: `${users.length} total users, ${managers.length} managers`
      };
      allIssues.push(...moduleIssues);
    } catch (err) {
      modules.auth_rls = { error: err.message };
    }

    // ==========================================
    // DETERMINE OVERALL STATUS
    // ==========================================
    const criticalCount = allIssues.filter(i => i.severity === 'critical').length;
    const warningCount = allIssues.filter(i => i.severity === 'warning').length;
    const status = criticalCount > 0 ? 'CRITICAL' : warningCount > 0 ? 'WARNING' : 'OK';

    // ==========================================
    // STORE TREND IN SystemHealthCheck
    // ==========================================
    try {
      const existingCheck = await base44.asServiceRole.entities.SystemHealthCheck.filter({
        key: 'rollback_audit_v2'
      });

      const auditRecord = {
        key: 'rollback_audit_v2',
        status: status,
        critical_count: criticalCount,
        warning_count: warningCount,
        run_at: runAt,
        last_run_counts: {
          orphaned_quantities: allIssues.find(i => i.check === 'orphaned_quantities')?.evidence?.count || 0,
          bad_image_urls: allIssues.find(i => i.check === 'image_upload_regression')?.evidence?.count || 0,
          mojibake_count: allIssues.find(i => i.check === 'encoding_regression')?.evidence?.count || 0,
          critical_stock_movements: allIssues.filter(i => i.check === 'stock_movement_integrity').length
        },
        data: JSON.stringify({ critical: allIssues.filter(i => i.severity === 'critical'), warnings: allIssues.filter(i => i.severity === 'warning') })
      };

      if (existingCheck.length > 0) {
        await base44.asServiceRole.entities.SystemHealthCheck.update(existingCheck[0].id, auditRecord);
      } else {
        await base44.asServiceRole.entities.SystemHealthCheck.create(auditRecord);
      }
    } catch (err) {
      console.warn('Could not save audit trend:', err);
    }

    return Response.json({
      success: true,
      run_at: runAt,
      status: status,
      critical: allIssues.filter(i => i.severity === 'critical'),
      warnings: allIssues.filter(i => i.severity === 'warning'),
      modules: modules,
      summary: {
        total_issues: allIssues.length,
        critical: criticalCount,
        warnings: warningCount
      }
    });

  } catch (error) {
    console.error('appRollbackAuditV2 error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});