import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
        }

        const { entity_type = 'both' } = await req.json().catch(() => ({}));

        let fixedJobs = 0;
        let fixedProjects = 0;

        // Fix Projects
        if (entity_type === 'projects' || entity_type === 'both') {
            const projects = await base44.asServiceRole.entities.Project.list();
            
            for (const project of projects) {
                if (project.deleted_at) continue;
                
                const updates = {};
                let needsUpdate = false;

                // If address_full exists but components are missing
                if ((project.address_full || project.address) && !project.address_street) {
                    // Try to parse from address_full
                    const fullAddress = project.address_full || project.address;
                    const parts = fullAddress.split(',').map(s => s.trim());
                    
                    if (parts.length >= 2) {
                        updates.address_street = parts[0] || null;
                        updates.address_suburb = parts.length >= 3 ? parts[parts.length - 3] : null;
                        updates.address_state = parts.length >= 2 ? parts[parts.length - 2].split(' ')[0] : null;
                        updates.address_postcode = parts.length >= 2 ? parts[parts.length - 2].split(' ')[1] : null;
                        needsUpdate = true;
                    }
                }

                // Ensure address_full is set if components exist
                if (!project.address_full && project.address_street) {
                    const addressParts = [
                        project.address_street,
                        project.address_suburb,
                        project.address_state && project.address_postcode 
                            ? `${project.address_state} ${project.address_postcode}` 
                            : project.address_state || project.address_postcode,
                        project.address_country
                    ].filter(Boolean);
                    
                    updates.address_full = addressParts.join(', ');
                    updates.address = updates.address_full; // Keep legacy field in sync
                    needsUpdate = true;
                }

                // Ensure country defaults
                if (!project.address_country) {
                    updates.address_country = 'Australia';
                    needsUpdate = true;
                }

                if (needsUpdate && Object.keys(updates).length > 0) {
                    await base44.asServiceRole.entities.Project.update(project.id, updates);
                    fixedProjects++;
                }
            }
        }

        // Fix Jobs
        if (entity_type === 'jobs' || entity_type === 'both') {
            const jobs = await base44.asServiceRole.entities.Job.list();
            
            for (const job of jobs) {
                if (job.deleted_at) continue;
                
                const updates = {};
                let needsUpdate = false;

                // Inherit from project if missing
                if (job.project_id && !job.address_full) {
                    try {
                        const project = await base44.asServiceRole.entities.Project.get(job.project_id);
                        
                        if (project.address_full || project.address) {
                            updates.address = project.address_full || project.address;
                            updates.address_full = project.address_full || project.address;
                            updates.address_street = project.address_street;
                            updates.address_suburb = project.address_suburb;
                            updates.address_state = project.address_state;
                            updates.address_postcode = project.address_postcode;
                            updates.address_country = project.address_country || 'Australia';
                            updates.google_place_id = project.google_place_id;
                            updates.latitude = project.latitude;
                            updates.longitude = project.longitude;
                            needsUpdate = true;
                        }
                    } catch (e) {
                        console.error(`Error fetching project ${job.project_id}:`, e);
                    }
                }

                // If address_full exists but components are missing
                if ((job.address_full || job.address) && !job.address_street && !needsUpdate) {
                    const fullAddress = job.address_full || job.address;
                    const parts = fullAddress.split(',').map(s => s.trim());
                    
                    if (parts.length >= 2) {
                        updates.address_street = parts[0] || null;
                        updates.address_suburb = parts.length >= 3 ? parts[parts.length - 3] : null;
                        updates.address_state = parts.length >= 2 ? parts[parts.length - 2].split(' ')[0] : null;
                        updates.address_postcode = parts.length >= 2 ? parts[parts.length - 2].split(' ')[1] : null;
                        needsUpdate = true;
                    }
                }

                // Ensure address_full is set if components exist
                if (!job.address_full && job.address_street && !needsUpdate) {
                    const addressParts = [
                        job.address_street,
                        job.address_suburb,
                        job.address_state && job.address_postcode 
                            ? `${job.address_state} ${job.address_postcode}` 
                            : job.address_state || job.address_postcode,
                        job.address_country
                    ].filter(Boolean);
                    
                    updates.address_full = addressParts.join(', ');
                    updates.address = updates.address_full;
                    needsUpdate = true;
                }

                // Ensure country defaults
                if (!job.address_country) {
                    updates.address_country = 'Australia';
                    needsUpdate = true;
                }

                if (needsUpdate && Object.keys(updates).length > 0) {
                    await base44.asServiceRole.entities.Job.update(job.id, updates);
                    fixedJobs++;
                }
            }
        }

        return Response.json({ 
            success: true, 
            fixed_jobs: fixedJobs,
            fixed_projects: fixedProjects,
            total_fixed: fixedJobs + fixedProjects
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});