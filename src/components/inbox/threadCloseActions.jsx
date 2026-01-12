/**
 * threadCloseActions.js - Close and reopen email threads
 * 
 * Close: Set userStatus='closed' + optional closedAt timestamp
 * Reopen: Clear userStatus (set to null)
 */

import { base44 } from '@/api/base44Client';

/**
 * Close a thread
 * @param {string} threadId - EmailThread ID
 * @param {string} userId - User ID closing the thread
 */
export async function closeThread(threadId, userId) {
  await base44.entities.EmailThread.update(threadId, {
    userStatus: 'closed',
    closedAt: new Date().toISOString(),
    closedBy: userId
  });

  // Log audit event
  await base44.functions.invoke('createEmailAudit', {
    type: 'THREAD_CLOSED',
    threadId,
    userId
  }).catch(err => console.warn('Audit log failed:', err));
}

/**
 * Reopen a thread (clear closed status)
 * @param {string} threadId - EmailThread ID
 * @param {string} userId - User ID reopening the thread
 */
export async function reopenThread(threadId, userId) {
  await base44.entities.EmailThread.update(threadId, {
    userStatus: null,
    closedAt: null,
    closedBy: null
  });

  // Log audit event
  await base44.functions.invoke('createEmailAudit', {
    type: 'THREAD_REOPENED',
    threadId,
    userId
  }).catch(err => console.warn('Audit log failed:', err));
}