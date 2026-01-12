import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entity_type, entity_id, attachment_url, attachment_name, is_image } = await req.json();

    if (!entity_type || !entity_id || !attachment_url) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // B7: Check access before proceeding
    const checkAccess = async (base44, user, entity_type, entity_id) => {
      if (user.role === 'admin' || user.extended_role === 'manager') {
        return { allowed: true };
      }

      if (user.role === 'user' && (user.extended_role === 'technician' || user.is_field_technician)) {
        try {
          if (entity_type === 'Job') {
            const job = await base44.entities.Job.get(entity_id);
            const assigned = job.assigned_to || [];
            if (assigned.includes(user.email)) {
              return { allowed: true };
            }
            return { allowed: false, reason: 'You are not assigned to this job' };
          }

          if (entity_type === 'Project') {
            const project = await base44.entities.Project.get(entity_id);
            const assigned = project.assigned_technicians || [];
            if (assigned.includes(user.email)) {
              return { allowed: true };
            }

            const jobs = await base44.entities.Job.filter({ project_id: entity_id });
            const userJobs = jobs.filter(
              j => !j.deleted_at && (j.assigned_to || []).includes(user.email)
            );
            if (userJobs.length > 0) {
              return { allowed: true };
            }

            return { allowed: false, reason: 'You are not assigned to this project or any of its jobs' };
          }

          return { allowed: false, reason: 'Invalid entity type' };
        } catch (err) {
          console.error('Access check error:', err);
          return { allowed: false, reason: 'Unable to verify access' };
        }
      }

      return { allowed: false, reason: 'Insufficient permissions' };
    };

    const access = await checkAccess(base44, user, entity_type, entity_id);
    if (!access.allowed) {
      console.log(`[B7] Attachment save denied: user=${user.email}, entity=${entity_type}/${entity_id}, reason=${access.reason}`);
      return Response.json({ error: access.reason }, { status: 403 });
    }

    // Audit log
    console.log(`[B7] Attachment save allowed: user=${user.email}, entity=${entity_type}/${entity_id}, is_image=${is_image}`);

    // Fetch the entity
    let entity;
    if (entity_type === 'Project') {
      entity = await base44.entities.Project.get(entity_id);
    } else if (entity_type === 'Job') {
      entity = await base44.entities.Job.get(entity_id);
    } else {
      return Response.json({ error: 'Invalid entity type' }, { status: 400 });
    }

    // Update based on type
    if (is_image) {
      const updated_images = [...(entity.image_urls || []), attachment_url];
      if (entity_type === 'Project') {
        await base44.asServiceRole.entities.Project.update(entity_id, { image_urls: updated_images });
      } else {
        await base44.asServiceRole.entities.Job.update(entity_id, { image_urls: updated_images });
      }
    } else {
      const updated_docs = [...(entity.other_documents || []), { url: attachment_url, name: attachment_name }];
      if (entity_type === 'Project') {
        await base44.asServiceRole.entities.Project.update(entity_id, { other_documents: updated_docs });
      } else {
        await base44.asServiceRole.entities.Job.update(entity_id, { other_documents: updated_docs });
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error adding attachment:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});