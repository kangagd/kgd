import { createClientFromRequest } from './shared/sdk.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        // ADMIN-ONLY
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        console.log('[auditXeroInvoiceLinks] Starting comprehensive audit...');

        // Fetch all entities
        const [allInvoices, allProjects, allJobs] = await Promise.all([
            base44.asServiceRole.entities.XeroInvoice.list(),
            base44.asServiceRole.entities.Project.list(),
            base44.asServiceRole.entities.Job.list()
        ]);

        console.log(`Loaded ${allInvoices.length} invoices, ${allProjects.length} projects, ${allJobs.length} jobs`);

        const issues = [];

        // 1. Check for dangling references in XeroInvoice entities
        for (const invoice of allInvoices) {
            const invoiceIssues = [];

            // Check project_id
            if (invoice.project_id) {
                const project = allProjects.find(p => p.id === invoice.project_id);
                if (!project) {
                    invoiceIssues.push({
                        type: 'dangling_project_reference',
                        message: `Project ID ${invoice.project_id} does not exist`
                    });
                } else if (project.deleted_at) {
                    invoiceIssues.push({
                        type: 'linked_to_deleted_project',
                        message: `Project #${project.project_number} is deleted`,
                        project_number: project.project_number
                    });
                }
            }

            // Check job_id
            if (invoice.job_id) {
                const job = allJobs.find(j => j.id === invoice.job_id);
                if (!job) {
                    invoiceIssues.push({
                        type: 'dangling_job_reference',
                        message: `Job ID ${invoice.job_id} does not exist`
                    });
                } else if (job.deleted_at) {
                    invoiceIssues.push({
                        type: 'linked_to_deleted_job',
                        message: `Job #${job.job_number} is deleted`,
                        job_number: job.job_number
                    });
                }
            }

            if (invoiceIssues.length > 0) {
                issues.push({
                    entity_type: 'XeroInvoice',
                    entity_id: invoice.id,
                    invoice_number: invoice.xero_invoice_number,
                    issues: invoiceIssues
                });
            }
        }

        // 2. Check Projects with xero_invoices array
        for (const project of allProjects) {
            if (project.deleted_at) continue; // Skip deleted projects

            const projectIssues = [];

            // Check xero_invoices array
            if (project.xero_invoices && project.xero_invoices.length > 0) {
                for (const invoiceId of project.xero_invoices) {
                    const invoice = allInvoices.find(inv => inv.id === invoiceId);
                    if (!invoice) {
                        projectIssues.push({
                            type: 'missing_invoice_in_array',
                            message: `Invoice ID ${invoiceId} in xero_invoices array does not exist`
                        });
                    } else if (invoice.project_id !== project.id) {
                        projectIssues.push({
                            type: 'invoice_not_linked_back',
                            message: `Invoice ${invoice.xero_invoice_number} in array doesn't link back to this project`,
                            invoice_number: invoice.xero_invoice_number,
                            invoice_links_to: invoice.project_id
                        });
                    }
                }
            }

            // Check primary_xero_invoice_id
            if (project.primary_xero_invoice_id) {
                const primaryInvoice = allInvoices.find(inv => inv.id === project.primary_xero_invoice_id);
                if (!primaryInvoice) {
                    projectIssues.push({
                        type: 'missing_primary_invoice',
                        message: `Primary invoice ID ${project.primary_xero_invoice_id} does not exist`
                    });
                } else if (primaryInvoice.project_id !== project.id) {
                    projectIssues.push({
                        type: 'primary_invoice_not_linked_back',
                        message: `Primary invoice ${primaryInvoice.xero_invoice_number} doesn't link back to this project`,
                        invoice_number: primaryInvoice.xero_invoice_number,
                        invoice_links_to: primaryInvoice.project_id
                    });
                }
            }

            if (projectIssues.length > 0) {
                issues.push({
                    entity_type: 'Project',
                    entity_id: project.id,
                    project_number: project.project_number,
                    issues: projectIssues
                });
            }
        }

        // 3. Check Jobs with xero_invoice_id
        for (const job of allJobs) {
            if (job.deleted_at) continue; // Skip deleted jobs

            const jobIssues = [];

            if (job.xero_invoice_id) {
                const invoice = allInvoices.find(inv => inv.id === job.xero_invoice_id);
                if (!invoice) {
                    jobIssues.push({
                        type: 'missing_invoice',
                        message: `Invoice ID ${job.xero_invoice_id} does not exist`
                    });
                } else if (invoice.job_id !== job.id) {
                    jobIssues.push({
                        type: 'invoice_not_linked_back',
                        message: `Invoice ${invoice.xero_invoice_number} doesn't link back to this job`,
                        invoice_number: invoice.xero_invoice_number,
                        invoice_links_to: invoice.job_id
                    });
                }
            }

            if (jobIssues.length > 0) {
                issues.push({
                    entity_type: 'Job',
                    entity_id: job.id,
                    job_number: job.job_number,
                    issues: jobIssues
                });
            }
        }

        // 4. Find invoices that claim to be linked but the target entity doesn't reference them back
        for (const invoice of allInvoices) {
            const orphanIssues = [];

            if (invoice.project_id) {
                const project = allProjects.find(p => p.id === invoice.project_id);
                if (project && !project.deleted_at) {
                    const isInArray = project.xero_invoices && project.xero_invoices.includes(invoice.id);
                    const isPrimary = project.primary_xero_invoice_id === invoice.id;

                    if (!isInArray && !isPrimary) {
                        orphanIssues.push({
                            type: 'invoice_orphaned_from_project',
                            message: `Invoice claims to be linked to project #${project.project_number}, but project doesn't reference it`,
                            project_number: project.project_number
                        });
                    }
                }
            }

            if (invoice.job_id) {
                const job = allJobs.find(j => j.id === invoice.job_id);
                if (job && !job.deleted_at && job.xero_invoice_id !== invoice.id) {
                    orphanIssues.push({
                        type: 'invoice_orphaned_from_job',
                        message: `Invoice claims to be linked to job #${job.job_number}, but job doesn't reference it`,
                        job_number: job.job_number
                    });
                }
            }

            if (orphanIssues.length > 0) {
                issues.push({
                    entity_type: 'XeroInvoice (Orphaned)',
                    entity_id: invoice.id,
                    invoice_number: invoice.xero_invoice_number,
                    issues: orphanIssues
                });
            }
        }

        // Group issues by type for summary
        const issueTypeCounts = {};
        issues.forEach(issue => {
            issue.issues.forEach(i => {
                issueTypeCounts[i.type] = (issueTypeCounts[i.type] || 0) + 1;
            });
        });

        return Response.json({
            total_issues_found: issues.length,
            issue_summary: issueTypeCounts,
            detailed_issues: issues,
            entities_scanned: {
                invoices: allInvoices.length,
                projects: allProjects.length,
                jobs: allJobs.length
            }
        });

    } catch (error) {
        console.error('[auditXeroInvoiceLinks] Fatal error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});