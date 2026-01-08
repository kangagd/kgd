import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { partId } = await req.json();

    if (!partId) {
      return Response.json({ error: 'partId is required' }, { status: 400 });
    }

    // Use service role to bypass RLS
    await base44.asServiceRole.entities.Part.delete(partId);

    return Response.json({ success: true, message: 'Part deleted successfully' });
  } catch (error) {
    console.error('Error deleting part:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});