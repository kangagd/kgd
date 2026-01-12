/**
 * diagnosticEmailThreads - Show all from_address values to diagnose sync issues
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all threads
    const allThreads = await base44.asServiceRole.entities.EmailThread.list(null, 1000);

    // Get unique from_address values with sample threads
    const fromAddressMap = new Map();
    allThreads.forEach(t => {
      if (t.from_address) {
        if (!fromAddressMap.has(t.from_address)) {
          fromAddressMap.set(t.from_address, []);
        }
        fromAddressMap.get(t.from_address).push({
          id: t.id,
          subject: t.subject,
          gmail_thread_id: t.gmail_thread_id,
          project_id: t.project_id,
          created_date: t.created_date
        });
      }
    });

    const result = Array.from(fromAddressMap.entries()).map(([addr, threads]) => ({
      from_address: addr,
      thread_count: threads.length,
      sample_threads: threads.slice(0, 3)
    }));

    return Response.json({
      total_threads: allThreads.length,
      unique_from_addresses: result.length,
      addresses: result
    });
  } catch (error) {
    console.error(`[diagnosticEmailThreads] Error:`, error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});