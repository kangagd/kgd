/**
 * Centralized React Query Configuration
 * Ensures consistent caching and refetch behavior across the app
 */

export const QUERY_CONFIG = {
  // Critical data - always fresh, refetch on window focus
  critical: {
    staleTime: 10000, // 10 seconds
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: (failureCount, error) => {
      // Don't retry on 429 rate limit errors
      if (error?.response?.status === 429) return false;
      return failureCount < 1; // Max 1 retry for other errors
    },
  },

  // Real-time data - auto-refresh every minute
  realtime: {
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every 60 seconds
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: (failureCount, error) => {
      if (error?.response?.status === 429) return false;
      return failureCount < 1;
    },
  },

  // Frequent updates - refetch on focus and mount
  frequent: {
    staleTime: 30000, // 30 seconds - increased from 10s
    refetchOnWindowFocus: false, // Disabled for performance
    refetchOnMount: true,
    retry: (failureCount, error) => {
      if (error?.response?.status === 429) return false;
      return failureCount < 1;
    },
  },

  // Reference data - can be cached longer
  reference: {
    staleTime: 300000, // 5 minutes - increased from 1 minute
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: (failureCount, error) => {
      if (error?.response?.status === 429) return false;
      return failureCount < 1;
    },
  },

  // Static data - rarely changes
  static: {
    staleTime: 600000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: (failureCount, error) => {
      if (error?.response?.status === 429) return false;
      return failureCount < 1;
    },
  },

  // Project detail lazy load - for tab-based data
  projectDetailLazy: {
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    keepPreviousData: true,
    retry: (failureCount, error) => {
      if (error?.response?.status === 429) return false;
      return failureCount < 1;
    },
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