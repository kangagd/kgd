/**
 * threadPinActions.js - Pin/unpin thread mutations and helpers
 * 
 * Handles:
 * - Pin thread: set pinnedAt + pinnedByUserId
 * - Unpin thread: clear pinnedAt + pinnedByUserId
 * - Audit logging for pin/unpin events
 */

import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export async function pinThread(threadId, userId) {
  try {
    const now = new Date().toISOString();

    // Update thread with pin metadata
    await base44.entities.EmailThread.update(threadId, {
      pinnedAt: now,
      pinnedByUserId: userId
    });

    // Log audit event
    try {
      await base44.functions.invoke('createEmailAudit', {
        type: 'THREAD_PINNED',
        threadId,
        userId,
        timestamp: now
      });
    } catch (auditError) {
      console.error('Failed to log pin audit:', auditError);
      // Don't fail the whole operation if audit fails
    }

    toast.success('Thread pinned');
    return true;
  } catch (error) {
    console.error('Pin thread error:', error);
    toast.error('Failed to pin thread');
    return false;
  }
}

export async function unpinThread(threadId, userId) {
  try {
    const now = new Date().toISOString();

    // Clear pin metadata
    await base44.entities.EmailThread.update(threadId, {
      pinnedAt: null,
      pinnedByUserId: null
    });

    // Log audit event
    try {
      await base44.functions.invoke('createEmailAudit', {
        type: 'THREAD_UNPINNED',
        threadId,
        userId,
        timestamp: now
      });
    } catch (auditError) {
      console.error('Failed to log unpin audit:', auditError);
    }

    toast.success('Thread unpinned');
    return true;
  } catch (error) {
    console.error('Unpin thread error:', error);
    toast.error('Failed to unpin thread');
    return false;
  }
}