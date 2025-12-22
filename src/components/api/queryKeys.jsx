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

// Inbox Module
export const inboxKeys = {
  all: ['inbox'],
  threads: () => [...inboxKeys.all, 'threads'],
  thread: (threadId) => [...inboxKeys.threads(), threadId],
  messages: (threadId) => [...inboxKeys.all, 'messages', threadId],
  drafts: () => [...inboxKeys.all, 'drafts'],
};