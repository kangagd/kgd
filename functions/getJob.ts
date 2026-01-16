import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * HARDENED getJob function with:
 * - Consistent role checks (admin OR extended_role === manager)
 * - Permission enforcement: technicians only if created_by OR assigned_to
 * - Read-only: NO auto-sync writes
 * - Data normalization: arrays, address fallback
 * - Integrity warnings for missing critical fields
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        // Parse jobId from request body
        const { jobId } = await req.json();
        if (!jobId) return Response.json({ error: 'Job ID required' }, { status: 400 });

        // Fetch job as service role
        const job = await base44.asServiceRole.entities.Job.get(jobId); 
        if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });

        // ===== PERMISSION CHECK =====
        const userEmail = user.email.toLowerCase().trim();
        
        // Admin or Manager (extended_role check for manager compatibility)
        const isAdminOrManager = user.role === 'admin' || user.extended_role === 'manager';
        
        // Technician: MUST be created_by OR in assigned_to (not auto-grant)
        const isTechnician = user.is_field_technician === true;
        
        let hasAccess = false;
        
        if (isAdminOrManager) {
            // Admins/managers get full access
            hasAccess = true;
        } else if (isTechnician) {
            // Technicians only if created_by or assigned_to
            if (job.created_by && job.created_by.toLowerCase().trim() === userEmail) {
                hasAccess = true;
            } else if (job.assigned_to) {
                if (Array.isArray(job.assigned_to)) {
                    hasAccess = job.assigned_to.some(email => email && email.toLowerCase().trim() === userEmail);
                } else if (typeof job.assigned_to === 'string') {
                    hasAccess = job.assigned_to.toLowerCase().trim() === userEmail;
                }
            }
        }

        if (!hasAccess) {
            return Response.json({ error: 'Access denied' }, { status: 403 });
        }

        // ===== DATA NORMALIZATION & INTEGRITY =====
        const integrityWarnings = [];

        // Normalize assigned_to to always be an array
        if (job.assigned_to && typeof job.assigned_to === 'string') {
            console.warn(`[getJob] assigned_to is string for jobId=${jobId}, should be array`);
            integrityWarnings.push('assigned_to_not_array');
            job.assigned_to = [job.assigned_to];
        } else if (!job.assigned_to) {
            job.assigned_to = [];
        }

        // Normalize assigned_to_name to always be an array
        if (job.assigned_to_name && typeof job.assigned_to_name === 'string') {
            job.assigned_to_name = [job.assigned_to_name];
        } else if (!job.assigned_to_name) {
            job.assigned_to_name = [];
        }

        // Address handling: prefer address_full, fallback to address in response only
        if (!job.address_full && job.address) {
            console.warn(`[getJob] address_full missing for jobId=${jobId}, using address fallback`);
            integrityWarnings.push('address_missing');
            job.address_full = job.address;
        } else if (!job.address_full && !job.address) {
            integrityWarnings.push('address_missing');
        }

        // Check for orphaned project reference
        if (job.project_id && !job.project_name) {
            console.warn(`[getJob] project_id exists but project_name missing for jobId=${jobId}`);
            integrityWarnings.push('project_name_missing');
        }

        // ===== RETURN RESPONSE =====
        const response = { ...job };
        if (integrityWarnings.length > 0) {
            response.integrity_warnings = integrityWarnings;
        }

        return Response.json(response);

    } catch (error) {
        console.error('[getJob] Error:', error.message);
        return Response.json({ error: error.message }, { status: 500 });
    }
});