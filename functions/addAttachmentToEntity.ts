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