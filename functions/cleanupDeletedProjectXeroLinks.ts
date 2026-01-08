import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        // ADMIN-ONLY
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const body = await req.json().catch(() => ({}));
        const dry_run = body.dry_run === false || body.dry_run === 'false' ? false : true;

        console.log('[cleanupDeletedProjectXeroLinks] Starting', { dry_run });

        // Fetch all projects and filter for deleted ones
        const allProjects = await base44.asServiceRole.entities.Project.list();
        const deletedProjects = allProjects.filter(p => p.deleted_at);

        console.log(`[cleanupDeletedProjectXeroLinks] Scanned ${allProjects.length} total projects, found ${deletedProjects.length} deleted projects`);

        const actions = [];
        let projectsUpdated = 0;

        for (const project of deletedProjects) {
            try {
                // Check if project has any Xero-related fields
                const hasXeroData = 
                    project.xero_payment_url || 
                    (project.xero_invoices && project.xero_invoices.length > 0) ||
                    project.primary_xero_invoice_id ||
                    project.legacy_xero_invoice_url;

                if (!hasXeroData) {
                    actions.push({
                        project_id: project.id,
                        project_number: project.project_number,
                        action: 'skipped',
                        message: 'No Xero data to clear'
                    });
                    continue;
                }

                if (!dry_run) {
                    // Clear all Xero-related fields
                    await base44.asServiceRole.entities.Project.update(project.id, {
                        xero_payment_url: null,
                        xero_invoices: [],
                        primary_xero_invoice_id: null,
                        legacy_xero_invoice_url: null
                    });
                    projectsUpdated++;
                }

                actions.push({
                    project_id: project.id,
                    project_number: project.project_number,
                    action: dry_run ? 'would_clear' : 'cleared',
                    xero_data_cleared: {
                        had_payment_url: !!project.xero_payment_url,
                        had_invoices: (project.xero_invoices || []).length,
                        had_primary_invoice: !!project.primary_xero_invoice_id,
                        had_legacy_url: !!project.legacy_xero_invoice_url
                    }
                });

            } catch (error) {
                console.error(`[cleanupDeletedProjectXeroLinks] Error processing project ${project.id}:`, error);
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
            deleted_projects_scanned: deletedProjects.length,
            projects_updated: projectsUpdated,
            actions,
            summary: dry_run 
                ? `Would clear Xero data from ${actions.filter(a => a.action === 'would_clear').length} deleted projects`
                : `Cleared Xero data from ${projectsUpdated} deleted projects`
        });

    } catch (error) {
        console.error('[cleanupDeletedProjectXeroLinks] Fatal error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});