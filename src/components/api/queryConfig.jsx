/**
 * Centralized React Query Configuration
 * Ensures consistent caching and refetch behavior across the app
 */

export const QUERY_CONFIG = {
  // Critical data - always fresh, refetch on window focus
  critical: {
    staleTime: 0, // Always consider stale
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  },

  // Real-time data - auto-refresh every few seconds
  realtime: {
    staleTime: 5000, // 5 seconds
    refetchInterval: 10000, // Refetch every 10 seconds
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  },

  // Frequent updates - refetch on focus and mount
  frequent: {
    staleTime: 10000, // 10 seconds
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  },

  // Reference data - can be cached longer
  reference: {
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  },

  // Static data - rarely changes
  static: {
    staleTime: 600000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  },
};

/**
 * Query key patterns for consistent invalidation
 */
export const QUERY_KEYS = {
  // Projects
  project: (id) => ['project', id],
  projects: () => ['projects'],
  projectJobs: (projectId) => ['projectJobs', projectId],
  projectParts: (projectId) => ['projectParts', projectId],
  projectMessages: (projectId) => ['projectMessages', projectId],
  projectEmailThreads: (projectId) => ['projectEmailThreads', projectId],
  projectEmailMessages: (projectId) => ['projectEmailMessages', projectId],
  projectXeroInvoices: (projectId) => ['projectXeroInvoices', projectId],
  projectQuotes: (projectId) => ['projectQuotes', projectId],
  projectTasks: (projectId) => ['projectTasks', projectId],
  projectContacts: (projectId) => ['projectContacts', projectId],
  projectTrades: (projectId) => ['projectTrades', projectId],
  
  // Jobs
  job: (id) => ['job', id],
  jobs: () => ['jobs'],
  allJobs: () => ['allJobs'],
  
  // Customers
  customer: (id) => ['customer', id],
  customers: () => ['customers'],
  
  // Email
  emailThread: (id) => ['emailThreadById', id],
  emailThreads: () => ['emailThreads'],
  
  // Reference data
  technicians: () => ['technicians'],
  jobTypes: () => ['jobTypes'],
  priceListItems: () => ['priceListItems'],
  inventoryQuantities: () => ['inventoryQuantities'],
};

/**
 * Helper to invalidate all project-related queries
 */
export const invalidateProjectData = (queryClient, projectId) => {
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.project(projectId) });
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects() });
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projectJobs(projectId) });
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projectParts(projectId) });
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projectMessages(projectId) });
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projectEmailThreads(projectId) });
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projectXeroInvoices(projectId) });
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projectQuotes(projectId) });
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projectTasks(projectId) });
};