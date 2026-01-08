import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * System Health Check - Detects Data Integrity Issues
 * Run this periodically to catch regressions early
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('[systemHealthCheck] Starting comprehensive health check...');

    const issues = [];
    const warnings = [];
    const stats = {};

    // Check 1: Xero Invoice Integrity
    try {
      const invoices = await base44.asServiceRole.entities.XeroInvoice.list();
      stats.total_invoices = invoices.length;

      let danglingProjectLinks = 0;
      let danglingJobLinks = 0;
      let missingRequiredFields = 0;
      let deprecatedFieldUsage = 0;

      for (const invoice of invoices) {
        // Check for dangling references
        if (invoice.project_id) {
          try {
            const project = await base44.asServiceRole.entities.Project.get(invoice.project_id);
            if (!project || project.deleted_at) {
              danglingProjectLinks++;
              issues.push({
                type: 'dangling_project_link',
                invoice_id: invoice.id,
                invoice_number: invoice.xero_invoice_number,
                project_id: invoice.project_id
              });
            }
          } catch (e) {
            danglingProjectLinks++;
          }
        }

        if (invoice.job_id) {
          try {
            const job = await base44.asServiceRole.entities.Job.get(invoice.job_id);
            if (!job || job.deleted_at) {
              danglingJobLinks++;
              issues.push({
                type: 'dangling_job_link',
                invoice_id: invoice.id,
                invoice_number: invoice.xero_invoice_number,
                job_id: invoice.job_id
              });
            }
          } catch (e) {
            danglingJobLinks++;
          }
        }

        // Check required fields
        if (!invoice.xero_invoice_id || !invoice.status) {
          missingRequiredFields++;
          issues.push({
            type: 'missing_required_fields',
            invoice_id: invoice.id,
            missing: [
              !invoice.xero_invoice_id && 'xero_invoice_id',
              !invoice.status && 'status'
            ].filter(Boolean)
          });
        }

        // Check for deprecated field usage
        if (!invoice.xero_invoice_number && invoice.invoice_number) {
          deprecatedFieldUsage++;
          warnings.push({
            type: 'deprecated_field',
            invoice_id: invoice.id,
            field: 'invoice_number (use xero_invoice_number)'
          });
        }
      }

      stats.invoice_issues = {
        dangling_project_links: danglingProjectLinks,
        dangling_job_links: danglingJobLinks,
        missing_required_fields: missingRequiredFields,
        deprecated_field_usage: deprecatedFieldUsage
      };
    } catch (error) {
      issues.push({ type: 'xero_invoice_check_failed', error: error.message });
    }

    // Check 2: Project-Quote Integrity
    try {
      const projects = await base44.asServiceRole.entities.Project.filter({ deleted_at: null });
      stats.total_active_projects = projects.length;

      let quoteMismatches = 0;
      let financialLockIssues = 0;

      for (const project of projects) {
        // Check primary quote exists
        if (project.primary_quote_id) {
          try {
            const quote = await base44.asServiceRole.entities.Quote.get(project.primary_quote_id);
            if (!quote) {
              quoteMismatches++;
              issues.push({
                type: 'missing_primary_quote',
                project_id: project.id,
                project_number: project.project_number,
                primary_quote_id: project.primary_quote_id
              });
            }
          } catch (e) {
            quoteMismatches++;
          }
        }

        // Check financial value lock consistency
        if (project.financial_value_locked && project.total_project_value === 0) {
          financialLockIssues++;
          warnings.push({
            type: 'financial_lock_with_zero_value',
            project_id: project.id,
            project_number: project.project_number
          });
        }
      }

      stats.project_issues = {
        quote_mismatches: quoteMismatches,
        financial_lock_issues: financialLockIssues
      };
    } catch (error) {
      issues.push({ type: 'project_check_failed', error: error.message });
    }

    // Check 3: Sample Integrity
    try {
      const samples = await base44.asServiceRole.entities.Sample.list();
      stats.total_samples = samples.length;

      let locationViolations = 0;
      let checkoutViolations = 0;

      for (const sample of samples) {
        // Check location rules
        if (sample.current_location_type === 'warehouse' && sample.current_location_reference_id !== null) {
          locationViolations++;
          issues.push({
            type: 'sample_location_violation',
            sample_id: sample.id,
            violation: 'current_location_reference_id must be null for warehouse'
          });
        }

        // Check checkout rules
        if (sample.checked_out_project_id) {
          if (sample.current_location_type !== 'project' || 
              sample.current_location_reference_id !== sample.checked_out_project_id) {
            checkoutViolations++;
            issues.push({
              type: 'sample_checkout_violation',
              sample_id: sample.id,
              violation: 'checkout fields inconsistent with location'
            });
          }
        }
      }

      stats.sample_issues = {
        location_violations: locationViolations,
        checkout_violations: checkoutViolations
      };
    } catch (error) {
      issues.push({ type: 'sample_check_failed', error: error.message });
    }

    // Check 4: Duplicate Detection
    try {
      const customers = await base44.asServiceRole.entities.Customer.filter({ deleted_at: null });
      const emailGroups = {};
      const phoneGroups = {};

      customers.forEach(c => {
        if (c.email) {
          const normalized = c.email.toLowerCase().trim();
          if (!emailGroups[normalized]) emailGroups[normalized] = [];
          emailGroups[normalized].push(c);
        }
        if (c.phone) {
          const normalized = c.phone.replace(/\D/g, '');
          if (!phoneGroups[normalized]) phoneGroups[normalized] = [];
          phoneGroups[normalized].push(c);
        }
      });

      const duplicateEmails = Object.values(emailGroups).filter(g => g.length > 1).length;
      const duplicatePhones = Object.values(phoneGroups).filter(g => g.length > 1).length;

      if (duplicateEmails > 0 || duplicatePhones > 0) {
        warnings.push({
          type: 'potential_duplicate_customers',
          duplicate_emails: duplicateEmails,
          duplicate_phones: duplicatePhones
        });
      }

      stats.duplicate_checks = {
        duplicate_emails: duplicateEmails,
        duplicate_phones: duplicatePhones
      };
    } catch (error) {
      issues.push({ type: 'duplicate_check_failed', error: error.message });
    }

    // Health Summary
    const health = issues.length === 0 ? 'HEALTHY' : 
                   issues.length < 10 ? 'DEGRADED' : 'CRITICAL';

    return Response.json({
      health,
      timestamp: new Date().toISOString(),
      summary: {
        critical_issues: issues.length,
        warnings: warnings.length,
        health_score: Math.max(0, 100 - (issues.length * 5) - (warnings.length * 1))
      },
      stats,
      issues: issues.slice(0, 50), // Limit response size
      warnings: warnings.slice(0, 50),
      recommendation: issues.length > 0 
        ? 'Run cleanup functions to resolve data integrity issues'
        : 'System is healthy'
    });

  } catch (error) {
    console.error('[systemHealthCheck] Fatal error:', error);
    return Response.json({ 
      health: 'ERROR',
      error: error.message 
    }, { status: 500 });
  }
});