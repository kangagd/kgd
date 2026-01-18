import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const jobTypes = await base44.entities.JobType.list();
    const emptyOnes = jobTypes.filter(jt => !jt.name || !jt.name.trim());
    
    const updated = [];
    for (const jt of emptyOnes) {
      // Generate a default name based on is_logistics flag
      const newName = jt.is_logistics ? `Logistics Job ${jt.id.slice(-6)}` : `Job Type ${jt.id.slice(-6)}`;
      
      await base44.entities.JobType.update(jt.id, { name: newName });
      updated.push({ id: jt.id, newName });
    }

    return Response.json({ fixed: updated.length, details: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});