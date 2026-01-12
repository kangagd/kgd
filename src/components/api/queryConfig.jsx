/**
 * Centralized React Query Configuration
 * Ensures consistent caching and refetch behavior across the app
 * 
 * RETRY STRATEGY:
 * - Transient (429, 503, network errors): Exponential backoff, max 4 retries + jitter
 * - Deterministic (400, 401, 403, 404): No retry (save quota)
 * - Other errors: Limited retry (1-2 attempts)
 * 
 * RECONNECT STRATEGY:
 * - refetchOnReconnect: false (prevent bursts on network reconnect)
 * - refetchOnMount: false/'stale-while-revalidate' (use cache, don't force refetch)
 */

// Intelligent retry logic by error type
const shouldRetry = (failureCount, error, maxRetries = 4) => {
  const status = error?.response?.status;
  
  // Deterministic errors - don't retry (save quota)
  if (status === 400 || status === 401 || status === 403 || status === 404) {
    return false;
  }
  
  // Transient errors - retry with exponential backoff
  if (status === 429 || status === 503 || !status) {
    return failureCount < maxRetries;
  }
  
  // Other HTTP errors - limited retry
  return failureCount < 2;
};

const getRetryDelay = (attemptIndex, error) => {
  const status = error?.response?.status;
  
  // Exponential backoff with jitter for transient errors
  // Prevents thundering herd of retries
  if (status === 429 || status === 503 || !status) {
    const baseDelay = Math.min(1000 * Math.pow(2, attemptIndex), 8000);
    const jitter = Math.random() * 1000; // ±1s jitter
    return baseDelay + jitter;
  }
  
  return 1000;
};

export const QUERY_CONFIG = {
  // Critical data - always fresh, but guards against reconnect bursts
  critical: {
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
    refetchOnReconnect: false, // Prevent burst on network reconnect
    refetchOnMount: 'stale-while-revalidate', // Use cache if available
    retry: shouldRetry,
    retryDelay: getRetryDelay,
  },

  // Real-time data - auto-refresh + guards
  // ONLY for: Inbox threads, live queues
  realtime: {
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every 60 seconds
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: 'stale-while-revalidate',
    retry: shouldRetry,
    retryDelay: getRetryDelay,
  },

  // Frequent updates - refetch on stale
  frequent: {
    staleTime: 60000, // 60 seconds
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: 'stale-while-revalidate',
    retry: shouldRetry,
    retryDelay: getRetryDelay,
  },

  // Reference data - can be cached longer
  // Invalidation pattern: Use explicit mutation -> invalidate detail or list
  reference: {
    staleTime: 300000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false, // Don't refetch - use cache or stale data
    retry: (failureCount, error) => shouldRetry(failureCount, error, 2), // Max 2 retries
    retryDelay: getRetryDelay,
  },

  // Static data - rarely changes
  static: {
    staleTime: 600000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: (failureCount, error) => shouldRetry(failureCount, error, 1), // Max 1 retry
    retryDelay: getRetryDelay,
  },

  // Project detail lazy load - for tab-based data
  projectDetailLazy: {
    staleTime: 120000, // 2 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    keepPreviousData: true,
    retry: shouldRetry,
    retryDelay: getRetryDelay,
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
 * INVALIDATION PATTERNS
 * 
 * Pattern 1: Detail Update → Invalidate detail + list
 * Pattern 2: List Action (create/delete) → Invalidate list only, setQueryData optimistic for detail
 * Pattern 3: Complex relationships → Invalidate related lists (e.g., project update → invalidate jobs)
 */

// Pattern 1: Project detail mutation
// invalidates: detail + list (used on save)
export const invalidateProjectDetail = (queryClient, projectId) => {
  queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
  queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
};

// Pattern 2: Job creation/deletion
// invalidates: list only (optimistic detail update handled in mutation)
export const invalidateJobList = (queryClient) => {
  queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
};

// Pattern 3: Complex project update
// invalidates: detail + all nested data
export const invalidateProjectData = (queryClient, projectId) => {
  queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
  queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
  queryClient.invalidateQueries({ queryKey: projectKeys.purchaseOrders(projectId) });
  queryClient.invalidateQueries({ queryKey: projectKeys.parts(projectId) });
  queryClient.invalidateQueries({ queryKey: projectKeys.emails(projectId) });
  queryClient.invalidateQueries({ queryKey: projectKeys.quotes(projectId) });
};