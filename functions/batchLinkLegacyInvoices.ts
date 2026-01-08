import { createClientFromRequest } from './shared/sdk.js';

// Batch link legacy invoice URLs to projects - admin only
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        // ADMIN-ONLY
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const body = await req.json();
        const dry_run = body.dry_run === false || body.dry_run === 'false' ? false : true;
        const limit = body.limit || 50;

        console.log('[batchLinkLegacyInvoices] Starting', { dry_run, limit });

        // Get all projects with legacy URLs
        const allProjects = await base44.asServiceRole.entities.Project.list();
        const legacyProjects = allProjects.filter(p => {
            const hasLegacyUrl = p.legacy_xero_invoice_url || p.invoice_url;
            const notDeleted = !p.deleted_at;
            return hasLegacyUrl && notDeleted;
        }).slice(0, limit);

        console.log(`[batchLinkLegacyInvoices] Found ${legacyProjects.length} projects with legacy URLs`);

        // Get ALL XeroInvoices once (with explicit high limit to ensure we get everything)
        const allInvoices = await base44.asServiceRole.entities.XeroInvoice.list('-created_date', 5000);
        console.log(`[batchLinkLegacyInvoices] Loaded ${allInvoices.length} total XeroInvoices`);

        const actions = [];
        let projectsUpdated = 0;
        let noMatchCount = 0;

        for (const project of legacyProjects) {
            try {
                const projectNumber = String(project.project_number);
                
                // Find all invoices matching this project number (exact + variations)
                const matchingInvoices = allInvoices.filter(inv => {
                    const invNumber = String(inv.xero_invoice_number || '').trim().toUpperCase();
                    const projNum = projectNumber.toUpperCase();
                    
                    // Match exact (3540)
                    if (invNumber === projNum) return true;
                    
                    // Match with decimal: 3540.1, 3540.2
                    if (invNumber.startsWith(`${projNum}.`)) return true;
                    
                    // Match with ANY letter suffix: 3540A, 3540B, 3540C, etc.
                    if (invNumber.startsWith(projNum)) {
                        const suffix = invNumber.slice(projNum.length);
                        // Check if suffix is one or more letters (A, B, C, AB, etc.)
                        if (/^[A-Z]+$/.test(suffix)) return true;
                    }
                    
                    return false;
                });

                if (matchingInvoices.length === 0) {
                    actions.push({
                        project_id: project.id,
                        project_number: project.project_number,
                        action: 'no_invoices_found',
                        message: 'No matching XeroInvoice entities found'
                    });
                    continue;
                }

                // Link all matching invoices to this project
                const invoiceIds = matchingInvoices.map(inv => inv.id);
                const primaryInvoice = matchingInvoices[0]; // Use first as primary

                if (!dry_run) {
                    // Update the project with linked invoices
                    await base44.asServiceRole.entities.Project.update(project.id, {
                        xero_invoices: invoiceIds,
                        primary_xero_invoice_id: primaryInvoice.id,
                        xero_payment_url: primaryInvoice.online_payment_url || primaryInvoice.online_invoice_url || null
                    });

                    // CRITICAL: Update each XeroInvoice to link back to the project
                    for (const invoice of matchingInvoices) {
                        await base44.asServiceRole.entities.XeroInvoice.update(invoice.id, {
                            project_id: project.id,
                            customer_id: project.customer_id,
                            customer_name: project.customer_name
                        });
                    }

                    projectsUpdated++;
                }

                actions.push({
                    project_id: project.id,
                    project_number: project.project_number,
                    action: dry_run ? 'would_link' : 'linked',
                    invoices_found: matchingInvoices.length,
                    invoice_numbers: matchingInvoices.map(inv => inv.xero_invoice_number),
                    invoice_ids: invoiceIds
                });

            } catch (error) {
                console.error(`[batchLinkLegacyInvoices] Error processing project ${project.id}:`, error);
                actions.push({
                    project_id: project.id,
                    project_number: project.project_number,
                    action: 'error',
                    message: error.message
                });
            }
        }

        return Response.json({
            dry_run,
            projects_scanned: legacyProjects.length,
            projects_updated: projectsUpdated,
            actions,
            summary: dry_run 
                ? `Would link invoices to ${legacyProjects.length} projects`
                : `Linked invoices to ${projectsUpdated} projects`
        });

    } catch (error) {
        console.error('[batchLinkLegacyInvoices] Fatal error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});