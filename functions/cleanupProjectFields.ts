import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { projectId, truncateNotes = true, maxNotesLength = 50000 } = await req.json();

    if (!projectId) {
      return Response.json({ error: 'projectId is required' }, { status: 400 });
    }

    const project = await base44.asServiceRole.entities.Project.get(projectId);

    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    const updates = {};
    let cleaned = false;

    // Function to strip HTML tags
    const stripHtml = (html) => {
      if (!html) return html;
      return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    };

    // Check and clean notes - strip HTML and truncate if needed
    if (project.notes && project.notes.length > 1000) {
      const strippedNotes = stripHtml(project.notes);
      const finalNotes = strippedNotes.length > maxNotesLength 
        ? strippedNotes.substring(0, maxNotesLength) + '\n\n[Note: Content was truncated]'
        : strippedNotes;
      
      if (finalNotes !== project.notes) {
        updates.notes = finalNotes;
        cleaned = true;
        console.log(`Cleaned notes from ${project.notes.length} to ${finalNotes.length} chars`);
      }
    }

    // Check and clean description - strip HTML if very long
    if (project.description && project.description.length > 2000) {
      const strippedDesc = stripHtml(project.description);
      if (strippedDesc !== project.description) {
        updates.description = strippedDesc;
        cleaned = true;
        console.log(`Cleaned description from ${project.description.length} to ${strippedDesc.length} chars`);
      }
    }

    if (cleaned) {
      await base44.asServiceRole.entities.Project.update(projectId, updates);
      return Response.json({
        success: true,
        projectId,
        project_number: project.project_number,
        cleaned: true,
        changes: {
          notes: project.notes?.length > maxNotesLength ? `Truncated from ${project.notes.length} to ${maxNotesLength} chars` : 'No change'
        }
      });
    }

    return Response.json({
      success: true,
      projectId,
      project_number: project.project_number,
      cleaned: false,
      message: 'No cleanup needed'
    });

  } catch (error) {
    console.error('Error in cleanupProjectFields:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});