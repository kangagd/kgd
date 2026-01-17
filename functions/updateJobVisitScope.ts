import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { job_id, patch, mode = 'safe' } = await req.json();

    if (!job_id || !patch) {
      return Response.json({ error: 'Missing required parameters: job_id, patch' }, { status: 400 });
    }

    // Load job as service role to ensure access
    const job = await base44.asServiceRole.entities.Job.get(job_id);
    if (!job) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    // Check permissions
    const isAdminOrManager = user.role === 'admin' || user.extended_role === 'manager';
    
    // For technicians, verify they are checked in to this job
    if (!isAdminOrManager) {
      const checkIns = await base44.asServiceRole.entities.CheckInOut.filter({
        job_id: job.id,
        technician_email: user.email
      });
      
      const hasActiveCheckIn = checkIns.some(c => !c.check_out_time);
      
      if (!hasActiveCheckIn) {
        return Response.json({ 
          error: 'Forbidden: Technicians can only update visit scope when checked in to the job' 
        }, { status: 403 });
      }
    }

    // Initialize visit_scope if missing
    let visitScope = job.visit_scope || {
      parts: [],
      trades: [],
      requirements: [],
      updated_at: null,
      updated_by: null
    };

    // Apply patch
    if (mode === 'replace' && patch.replace_all) {
      // Replace mode (admin/manager only)
      if (!isAdminOrManager) {
        return Response.json({ 
          error: 'Forbidden: Only admin/manager can use replace mode' 
        }, { status: 403 });
      }
      visitScope = patch.replace_all;
    } else {
      // Safe mode: add and remove
      
      // Add items (dedupe by key)
      if (patch.add) {
        const existingKeys = new Set([
          ...(visitScope.parts || []).map(p => p.key),
          ...(visitScope.trades || []).map(t => t.key),
          ...(visitScope.requirements || []).map(r => r.key)
        ]);

        if (patch.add.parts) {
          for (const part of patch.add.parts) {
            if (!existingKeys.has(part.key)) {
              visitScope.parts = [...(visitScope.parts || []), part];
              existingKeys.add(part.key);
            }
          }
        }

        if (patch.add.trades) {
          for (const trade of patch.add.trades) {
            if (!existingKeys.has(trade.key)) {
              visitScope.trades = [...(visitScope.trades || []), trade];
              existingKeys.add(trade.key);
            }
          }
        }

        if (patch.add.requirements) {
          for (const req of patch.add.requirements) {
            if (!existingKeys.has(req.key)) {
              visitScope.requirements = [...(visitScope.requirements || []), req];
              existingKeys.add(req.key);
            }
          }
        }
      }

      // Remove items by key
      if (patch.remove_keys && Array.isArray(patch.remove_keys)) {
        const removeSet = new Set(patch.remove_keys);
        visitScope.parts = (visitScope.parts || []).filter(p => !removeSet.has(p.key));
        visitScope.trades = (visitScope.trades || []).filter(t => !removeSet.has(t.key));
        visitScope.requirements = (visitScope.requirements || []).filter(r => !removeSet.has(r.key));
      }
    }

    // Update metadata
    visitScope.updated_at = new Date().toISOString();
    visitScope.updated_by = user.email;

    // Save to job
    await base44.asServiceRole.entities.Job.update(job.id, {
      visit_scope: visitScope
    });

    return Response.json({ 
      success: true, 
      visit_scope: visitScope 
    });
  } catch (error) {
    console.error('Error updating visit scope:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});