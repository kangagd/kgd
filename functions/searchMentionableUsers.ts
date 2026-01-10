import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { q } = await req.json();

    if (!q || typeof q !== 'string' || q.length < 2) {
      return Response.json({ results: [] });
    }

    // Fetch all users via service role
    const allUsers = await base44.asServiceRole.entities.User.list();

    // Filter by search query (email or name)
    const lowerQ = q.toLowerCase();
    const filtered = allUsers
      .filter(u => 
        u.email.toLowerCase().includes(lowerQ) ||
        (u.full_name?.toLowerCase().includes(lowerQ)) ||
        (u.display_name?.toLowerCase().includes(lowerQ))
      )
      .slice(0, 8)
      .map(u => ({
        id: u.id,
        email: u.email,
        display_name: u.display_name || u.full_name,
        role: u.role
      }));

    return Response.json({ results: filtered });
  } catch (error) {
    console.error('searchMentionableUsers error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});