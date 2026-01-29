import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * ensureLogisticsJobLocations (v2 - Bulk Enabled)
 * 
 * Ensures logistics jobs have from/to location IDs set.
 * Infers missing locations based on job context (logistics_purpose, PO, etc.)
 * Does NOT overwrite existing user-set locations or manually-set locations.
 * 
 * Input Modes:
 * A) Single:    { job_id: string, dry_run?: boolean }
 * B) Bulk:      { job_ids: string[], dry_run?: boolean }
 * C) Bulk-by-PO: { purchase_order_id: string, limit?: number, dry_run?: boolean }
 * D) Bulk-by-POs: { purchase_order_ids: string[], dry_run?: boolean }
 * E) All POs:   { all_pos: true, limit?: number, dry_run?: boolean }
 * 
 * Output (Single Mode): { 
 *   updated: boolean, 
 *   needs_manual: boolean, 
 *   from_location_id: string|null, 
 *   to_location_id: string|null,
 *   reason?: string
 * }
 * 
 * Output (Bulk Mode): {
 *   success: true,
 *   scanned: number,
 *   updated: number,
 *   unchanged: number,
 *   needs_manual: number,
 *   results: [
 *     {
 *       job_id: string,
 *       before: { from_location_id, to_location_id },
 *       after: { from_location_id, to_location_id },
 *       updated: boolean,
 *       needs_manual: boolean,
 *       reason: string
 *     }
 *   ]
 * }
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { job_id, job_ids, purchase_order_id, purchase_order_ids, all_pos, limit = 50, dry_run = false } = await req.json();

    // Determine mode
    const isSingleMode = !!job_id;
    const isBulkMode = Array.isArray(job_ids) && job_ids.length > 0;
    const isBulkByPO = !!purchase_order_id;
    const isBulkByPOs = Array.isArray(purchase_order_ids) && purchase_order_ids.length > 0;
    const isAllPOs = all_pos === true;

    if (!isSingleMode && !isBulkMode && !isBulkByPO && !isBulkByPOs && !isAllPOs) {
      return Response.json({ 
        error: 'Must provide job_id, job_ids, purchase_order_id, purchase_order_ids, or all_pos' 
      }, { status: 400 });
    }

    // Collect job IDs to process
    let jobIdsToProcess = [];
    
    if (isSingleMode) {
      jobIdsToProcess = [job_id];
    } else if (isBulkMode) {
      jobIdsToProcess = job_ids;
    } else if (isBulkByPO) {
      // Fetch jobs for this single PO
      const jobs = await base44.asServiceRole.entities.Job.filter(
        { purchase_order_id, is_logistics_job: true },
        '-created_date',
        limit
      );
      jobIdsToProcess = jobs.map(j => j.id);
    } else if (isBulkByPOs) {
      // Fetch jobs for multiple POs
      for (const poId of purchase_order_ids) {
        const jobs = await base44.asServiceRole.entities.Job.filter(
          { purchase_order_id: poId, is_logistics_job: true },
          '-created_date',
          limit
        );
        jobIdsToProcess.push(...jobs.map(j => j.id));
      }
    } else if (isAllPOs) {
      // Fetch all POs and their logistics jobs
      const allPOs = await base44.asServiceRole.entities.PurchaseOrder.list('-created_date');
      for (const po of allPOs) {
        const jobs = await base44.asServiceRole.entities.Job.filter(
          { purchase_order_id: po.id, is_logistics_job: true },
          '-created_date',
          limit
        );
        jobIdsToProcess.push(...jobs.map(j => j.id));
      }
    }

    if (jobIdsToProcess.length === 0) {
      return Response.json({ 
        error: 'No jobs to process' 
      }, { status: 400 });
    }

    // Process each job
    const results = [];
    let scanned = 0;
    let updated = 0;
    let unchanged = 0;
    let needsManualCount = 0;

    for (const jobId of jobIdsToProcess) {
      scanned++;
      
      // Load job
      const job = await base44.asServiceRole.entities.Job.get(jobId);
      if (!job) {
        results.push({
          job_id: jobId,
          before: { from_location_id: null, to_location_id: null },
          after: { from_location_id: null, to_location_id: null },
          updated: false,
          needs_manual: false,
          reason: 'job_not_found'
        });
        unchanged++;
        continue;
      }

      if (!job.is_logistics_job) {
        results.push({
          job_id: jobId,
          before: { from_location_id: null, to_location_id: null },
          after: { from_location_id: null, to_location_id: null },
          updated: false,
          needs_manual: false,
          reason: 'not_logistics_job'
        });
        unchanged++;
        continue;
      }

      // Check manual override protection
      if (job.locations_manually_set === true) {
        results.push({
          job_id: jobId,
          before: { 
            from_location_id: job.source_location_id, 
            to_location_id: job.destination_location_id 
          },
          after: { 
            from_location_id: job.source_location_id, 
            to_location_id: job.destination_location_id 
          },
          updated: false,
          needs_manual: false,
          reason: 'manual_locked'
        });
        unchanged++;
        continue;
      }

      const beforeFrom = job.source_location_id;
      const beforeTo = job.destination_location_id;

      let fromLocationId = beforeFrom;
      let toLocationId = beforeTo;
      let jobUpdated = false;
      let jobNeedsManual = false;
      const updateData = {};

      // If both already set, nothing to do
      if (fromLocationId && toLocationId) {
        results.push({
          job_id: jobId,
          before: { from_location_id: beforeFrom, to_location_id: beforeTo },
          after: { from_location_id: beforeFrom, to_location_id: beforeTo },
          updated: false,
          needs_manual: false,
          reason: 'already_complete'
        });
        unchanged++;
        continue;
      }

      // Infer FROM location (only if not set)
      if (!fromLocationId) {
        if (job.logistics_purpose === 'po_pickup_from_supplier' || job.logistics_purpose === 'po_delivery_to_warehouse') {
          // Get supplier location from PO
          if (job.purchase_order_id) {
            const po = await base44.asServiceRole.entities.PurchaseOrder.get(job.purchase_order_id);
            if (po?.supplier_id) {
              const supplierLocs = await base44.asServiceRole.entities.InventoryLocation.filter({
                type: 'supplier',
                supplier_id: po.supplier_id,
                is_active: true
              });
              if (supplierLocs.length > 0) {
                fromLocationId = supplierLocs[0].id;
                updateData.source_location_id = fromLocationId;
                updateData.from_location_inferred = true;
                jobUpdated = true;
              }
            }
          }
        } else if (job.logistics_purpose === 'part_pickup_for_install') {
          // Default to main warehouse
          const warehouses = await base44.asServiceRole.entities.InventoryLocation.filter({
            type: 'warehouse',
            is_active: true
          });
          if (warehouses.length > 0) {
            fromLocationId = warehouses[0].id;
            updateData.source_location_id = fromLocationId;
            updateData.from_location_inferred = true;
            jobUpdated = true;
          }
        }

        if (!fromLocationId) {
          jobNeedsManual = true;
        }
      }

      // Infer TO location (only if not set)
      if (!toLocationId) {
        if (job.logistics_purpose === 'po_delivery_to_warehouse' || job.logistics_purpose === 'po_pickup_from_supplier') {
          // Default to main warehouse
          const warehouses = await base44.asServiceRole.entities.InventoryLocation.filter({
            type: 'warehouse',
            is_active: true
          });
          if (warehouses.length > 0) {
            toLocationId = warehouses[0].id;
            updateData.destination_location_id = toLocationId;
            updateData.to_location_inferred = true;
            jobUpdated = true;
          }
        } else if (job.logistics_purpose === 'part_pickup_for_install') {
          // Use assigned vehicle if available
          if (job.vehicle_id) {
            const vehicleLocs = await base44.asServiceRole.entities.InventoryLocation.filter({
              type: 'vehicle',
              vehicle_id: job.vehicle_id,
              is_active: true
            });
            if (vehicleLocs.length > 0) {
              toLocationId = vehicleLocs[0].id;
              updateData.destination_location_id = toLocationId;
              updateData.to_location_inferred = true;
              jobUpdated = true;
            }
          } else if (job.project_id) {
            // Vehicle not assigned - try project address + client-site location
            const project = await base44.asServiceRole.entities.Project.get(job.project_id);
            if (project?.address_full) {
              updateData.destination_address = project.address_full;
              jobUpdated = true;
            }
            
            // Try to find a client-site location
            const clientSiteLocs = await base44.asServiceRole.entities.InventoryLocation.filter({
              type: 'client_site',
              is_active: true
            });
            if (clientSiteLocs.length > 0) {
              toLocationId = clientSiteLocs[0].id;
              updateData.destination_location_id = toLocationId;
              updateData.to_location_inferred = true;
              jobUpdated = true;
            } else {
              // No client-site location exists - mark needs manual
              jobNeedsManual = true;
            }
          }
        }

        if (!toLocationId) {
          jobNeedsManual = true;
        }
      }

      // Write updates (if not dry_run and something changed)
      if (!dry_run && jobUpdated && Object.keys(updateData).length > 0) {
        updateData.locations_last_inferred_at = new Date().toISOString();
        await base44.asServiceRole.entities.Job.update(jobId, updateData);
      }

      results.push({
        job_id: jobId,
        before: { from_location_id: beforeFrom, to_location_id: beforeTo },
        after: { from_location_id: fromLocationId, to_location_id: toLocationId },
        updated: jobUpdated,
        needs_manual: jobNeedsManual,
        reason: jobNeedsManual 
          ? 'missing_locations' 
          : jobUpdated 
            ? 'inferred_successfully' 
            : 'already_complete'
      });

      if (jobUpdated) updated++;
      else if (jobNeedsManual) needsManualCount++;
      else unchanged++;
    }

    // Return single-mode shape for backwards compatibility
    if (isSingleMode) {
      const singleResult = results[0];
      return Response.json({
        updated: singleResult.updated,
        needs_manual: singleResult.needs_manual,
        from_location_id: singleResult.after.from_location_id,
        to_location_id: singleResult.after.to_location_id,
        reason: singleResult.reason
      });
    }

    // Return bulk shape
    return Response.json({
      success: true,
      scanned,
      updated,
      unchanged,
      needs_manual: needsManualCount,
      results
    });

  } catch (error) {
    console.error('[ensureLogisticsJobLocations] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});