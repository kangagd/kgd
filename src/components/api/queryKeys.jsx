/**
 * Centralized React Query cache keys
 * Single source of truth for all query invalidation and caching
 */

// Jobs Module
export const jobKeys = {
  all: ['jobs'],
  lists: () => [...jobKeys.all, 'list'],
  list: (filters) => [...jobKeys.lists(), filters],
  allJobs: () => [...jobKeys.all, 'allJobs'],
  details: () => [...jobKeys.all, 'detail'],
  detail: (id) => [...jobKeys.details(), id],
  tasks: (jobId) => [...jobKeys.all, 'tasks', jobId],
  messages: (jobId) => [...jobKeys.all, 'messages', jobId],
  checkIns: (jobId) => [...jobKeys.all, 'checkIns', jobId],
  lineItems: (jobId) => [...jobKeys.all, 'lineItems', jobId],
  summaries: (jobId) => [...jobKeys.all, 'summaries', jobId],
};

// Projects Module
export const projectKeys = {
  all: ['projects'],
  lists: () => [...projectKeys.all, 'list'],
  list: (filters) => [...projectKeys.lists(), filters],
  details: () => [...projectKeys.all, 'detail'],
  detail: (id) => [...projectKeys.details(), id],
  purchaseOrders: (projectId) => [...projectKeys.all, 'purchaseOrders', projectId],
  parts: (projectId) => [...projectKeys.all, 'parts', projectId],
  messages: (projectId) => [...projectKeys.all, 'messages', projectId],
  emails: (projectId) => [...projectKeys.all, 'emails', projectId],
  quotes: (projectId) => [...projectKeys.all, 'quotes', projectId],
};

// Vehicles Module
export const vehicleKeys = {
  all: ['vehicles'],
  lists: () => [...vehicleKeys.all, 'list'],
  list: (filters) => [...vehicleKeys.lists(), filters],
  details: () => [...vehicleKeys.all, 'detail'],
  detail: (id) => [...vehicleKeys.details(), id],
  stock: (vehicleId) => [...vehicleKeys.all, 'stock', vehicleId],
  stockMovements: (vehicleId) => [...vehicleKeys.all, 'stockMovements', vehicleId],
  tools: (vehicleId) => [...vehicleKeys.all, 'tools', vehicleId],
  samples: (vehicleId) => [...vehicleKeys.all, 'samples', vehicleId],
};

// Inbox Module (realtime config only - CRITICAL for live updates)
export const inboxKeys = {
  all: ['inbox'],
  threads: () => [...inboxKeys.all, 'threads'],     // Uses: realtime config
  thread: (threadId) => [...inboxKeys.threads(), threadId],
  messages: (threadId) => [...inboxKeys.all, 'messages', threadId],
  drafts: () => [...inboxKeys.all, 'drafts'],
};

/**
 * Invalidation patterns documented here
 * 
 * JOB MUTATIONS:
 * - Create: invalidateJobList() (list only, optimistic detail)
 * - Update: jobKeys.detail(id) only (no list refresh)
 * - Delete: invalidateJobList() (list only)
 * 
 * PROJECT MUTATIONS:
 * - Create: invalidateJobList if related
 * - Update detail: invalidateProjectDetail(projectId)
 * - Update complex: invalidateProjectData(projectId)
 * 
 * INBOX MUTATIONS:
 * - Link/Unlink thread: Invalidate inboxKeys.threads() + projectKeys.emails(projectId)
 * - Send message: Invalidate inboxKeys.messages(threadId)
 * - Status change: setQueryData optimistic + invalidate lists
 */