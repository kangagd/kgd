/**
 * createEmailAudit - Log email thread audit events
 * 
 * Logs:
 * - THREAD_PINNED
 * - THREAD_UNPINNED
 * - THREAD_ASSIGNED
 * - THREAD_LINKED
 * - etc.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, threadId, userId, timestamp, details } = await req.json();

    if (!type || !threadId) {
      return Response.json({ error: 'type and threadId are required' }, { status: 400 });
    }

    // Create audit record
    const auditRecord = await base44.asServiceRole.entities.EmailAudit.create({
      type,
      thread_id: threadId,
      user_id: userId || user.id,
      user_email: userId ? null : user.email,
      timestamp: timestamp || new Date().toISOString(),
      details: details ? JSON.stringify(details) : null
    });

    return Response.json({
      success: true,
      audit_id: auditRecord.id
    });

  } catch (error) {
    console.error('[createEmailAudit] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});