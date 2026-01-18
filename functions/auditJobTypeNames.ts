import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const jobTypes = await base44.entities.JobType.list();

    const results = {
      total: jobTypes.length,
      withNames: [],
      missingNames: []
    };

    jobTypes.forEach(jt => {
      if (jt.name && jt.name.trim()) {
        results.withNames.push({
          id: jt.id,
          name: jt.name,
          is_active: jt.is_active,
          is_logistics: jt.is_logistics
        });
      } else {
        results.missingNames.push({
          id: jt.id,
          name: jt.name || '[empty]',
          is_active: jt.is_active
        });
      }
    });

    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});