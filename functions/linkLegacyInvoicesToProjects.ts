import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

        console.log('[linkLegacyInvoicesToProjects] Starting', { dry_run, limit });

        // Get all projects with legacy URLs
        const allProjects = await base44.asServiceRole.entities.Project.list();
        const legacyProjects = allProjects.filter(p => {
            const hasLegacyUrl = p.legacy_xero_invoice_url || p.invoice_url;
            const notDeleted = !p.deleted_at;
            return hasLegacyUrl && notDeleted;
        }).slice(0, limit);

        console.log(`[linkLegacyInvoicesToProjects] Found ${legacyProjects.length} projects with legacy URLs`);

        // Get ALL XeroInvoices once
        const allInvoices = await base44.asServiceRole.entities.XeroInvoice.list();
        console.log(`[linkLegacyInvoicesToProjects] Loaded ${allInvoices.length} total XeroInvoices`);

        const actions = [];
        let projectsUpdated = 0;

        for (const project of legacyProjects) {
            try {
                const projectNumber = String(project.project_number);
                
                // Find all invoices matching this project number (exact + variations)
                const matchingInvoices = allInvoices.filter(inv => {
                    const invNumber = String(inv.xero_invoice_number || '');
                    // Match exact (3540) or variations (3540.2, 3540B, 3540C, etc)
                    return invNumber === projectNumber || 
                           invNumber.startsWith(`${projectNumber}.`) ||
                           invNumber.startsWith(`${projectNumber}B`) ||
                           invNumber.startsWith(`${projectNumber}C`) ||
                           invNumber.startsWith(`${projectNumber}D`);
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
                    await base44.asServiceRole.entities.Project.update(project.id, {
                        xero_invoices: invoiceIds,
                        primary_xero_invoice_id: primaryInvoice.id,
                        xero_payment_url: primaryInvoice.online_payment_url || primaryInvoice.online_invoice_url || null
                    });
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
                console.error(`[linkLegacyInvoicesToProjects] Error processing project ${project.id}:`, error);
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
        console.error('[linkLegacyInvoicesToProjects] Fatal error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});