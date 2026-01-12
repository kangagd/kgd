/**
 * Centralized React Query Configuration
 * Ensures consistent caching and refetch behavior across the app
 */

export const QUERY_CONFIG = {
  // Critical data - rely on staleTime, don't cascade on window focus
  critical: {
    staleTime: 30000, // 30 seconds - reduced refetches
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: (failureCount, error) => {
      // Retry 429 with exponential backoff
      if (error?.response?.status === 429) {
        return failureCount < 3; // Retry up to 3 times
      }
      return failureCount < 2;
    },
    retryDelay: (attemptIndex, error) => {
      // Exponential backoff for 429 errors: 1s, 2s, 4s
      if (error?.response?.status === 429) {
        return Math.min(1000 * Math.pow(2, attemptIndex), 4000);
      }
      return 1000;
    },
  },

  // Real-time data - rely on subscriptions + staleTime, not aggressive refetch
  realtime: {
    staleTime: 30000, // 30 seconds
    refetchInterval: false, // Disabled - use real-time subscriptions instead
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: (failureCount, error) => {
      if (error?.response?.status === 429) {
        return failureCount < 3;
      }
      return failureCount < 2;
    },
    retryDelay: (attemptIndex, error) => {
      if (error?.response?.status === 429) {
        return Math.min(1000 * Math.pow(2, attemptIndex), 4000);
      }
      return 1000;
    },
  },

  // Frequent updates - refetch on focus and mount
  frequent: {
    staleTime: 60000, // 60 seconds - longer cache
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: (failureCount, error) => {
      if (error?.response?.status === 429) {
        return failureCount < 3;
      }
      return failureCount < 2;
    },
    retryDelay: (attemptIndex, error) => {
      if (error?.response?.status === 429) {
        return Math.min(1000 * Math.pow(2, attemptIndex), 4000);
      }
      return 1000;
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
    staleTime: 120000, // 2 minutes - much longer cache
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Don't refetch on mount - use cached data
    keepPreviousData: true,
    retry: (failureCount, error) => {
      if (error?.response?.status === 429) {
        return failureCount < 3;
      }
      return failureCount < 2;
    },
    retryDelay: (attemptIndex, error) => {
      if (error?.response?.status === 429) {
        return Math.min(1000 * Math.pow(2, attemptIndex), 4000);
      }
      return 1000;
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