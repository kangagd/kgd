/**
 * Status Registry
 * Central source of truth for all entity statuses, labels, and colors
 * 
 * Consolidates status definitions from:
 * - Jobs, Projects, Tasks, Purchase Orders
 * - Parts, Samples, Quotes, Invoices
 * - Customers, Contracts, Email threads
 */

// ============================================================================
// GENERIC NORMALIZER
// ============================================================================

/**
 * Normalize status value to lowercase, underscore-separated format
 * @param {string} value - Raw status value
 * @returns {string} Normalized status
 */
export function normalizeStatus(value) {
  if (!value) return '';
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_');
}

// ============================================================================
// JOB STATUS
// ============================================================================

export const JOB_STATUS = {
  OPEN: 'Open',
  SCHEDULED: 'Scheduled',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const JOB_STATUS_LABELS = {
  open: 'Open',
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const JOB_STATUS_COLORS = {
  open: 'bg-blue-100 text-blue-800',
  scheduled: 'bg-amber-100 text-amber-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

// ============================================================================
// PROJECT STAGE
// ============================================================================

export const PROJECT_STAGE = {
  LEAD: 'Lead',
  INITIAL_SITE_VISIT: 'Initial Site Visit',
  CREATE_QUOTE: 'Create Quote',
  QUOTE_SENT: 'Quote Sent',
  QUOTE_APPROVED: 'Quote Approved',
  FINAL_MEASURE: 'Final Measure',
  PARTS_ORDERED: 'Parts Ordered',
  SCHEDULED: 'Scheduled',
  COMPLETED: 'Completed',
  WARRANTY: 'Warranty',
  LOST: 'Lost',
};

const PROJECT_STATUS_LABELS = {
  lead: 'Lead',
  initial_site_visit: 'Initial Site Visit',
  create_quote: 'Create Quote',
  quote_sent: 'Quote Sent',
  quote_approved: 'Quote Approved',
  final_measure: 'Final Measure',
  parts_ordered: 'Parts Ordered',
  scheduled: 'Scheduled',
  completed: 'Completed',
  warranty: 'Warranty',
  lost: 'Lost',
};

const PROJECT_STATUS_COLORS = {
  lead: 'bg-purple-100 text-purple-800',
  initial_site_visit: 'bg-blue-100 text-blue-800',
  create_quote: 'bg-indigo-100 text-indigo-800',
  quote_sent: 'bg-cyan-100 text-cyan-800',
  quote_approved: 'bg-teal-100 text-teal-800',
  final_measure: 'bg-sky-100 text-sky-800',
  parts_ordered: 'bg-amber-100 text-amber-800',
  scheduled: 'bg-orange-100 text-orange-800',
  completed: 'bg-green-100 text-green-800',
  warranty: 'bg-emerald-100 text-emerald-800',
  lost: 'bg-gray-100 text-gray-800',
};

// ============================================================================
// PURCHASE ORDER STATUS
// ============================================================================

export const PO_STATUS = {
  DRAFT: 'draft',
  SENT: 'sent',
  ON_ORDER: 'on_order',
  IN_TRANSIT: 'in_transit',
  IN_LOADING_BAY: 'in_loading_bay',
  IN_STORAGE: 'in_storage',
  IN_VEHICLE: 'in_vehicle',
  INSTALLED: 'installed',
  CANCELLED: 'cancelled',
};

const PO_STATUS_LABELS = {
  draft: 'Draft',
  sent: 'Sent',
  on_order: 'On Order',
  in_transit: 'In Transit',
  in_loading_bay: 'In Loading Bay',
  in_storage: 'In Storage',
  in_vehicle: 'In Vehicle',
  installed: 'Installed',
  cancelled: 'Cancelled',
};

const PO_STATUS_COLORS = {
  draft: 'bg-gray-200 text-gray-800',
  sent: 'bg-blue-200 text-blue-800',
  on_order: 'bg-amber-200 text-amber-800',
  in_transit: 'bg-purple-200 text-purple-800',
  in_loading_bay: 'bg-orange-200 text-orange-800',
  in_storage: 'bg-green-200 text-green-800',
  in_vehicle: 'bg-indigo-200 text-indigo-800',
  installed: 'bg-teal-200 text-teal-800',
  cancelled: 'bg-red-200 text-red-800',
};

// ============================================================================
// PART STATUS
// ============================================================================

export const PART_STATUS = {
  PENDING: 'pending',
  ON_ORDER: 'on_order',
  IN_TRANSIT: 'in_transit',
  IN_LOADING_BAY: 'in_loading_bay',
  IN_STORAGE: 'in_storage',
  IN_VEHICLE: 'in_vehicle',
  INSTALLED: 'installed',
  CANCELLED: 'cancelled',
};

const PART_STATUS_LABELS = {
  pending: 'Pending',
  on_order: 'On Order',
  in_transit: 'In Transit',
  in_loading_bay: 'In Loading Bay',
  in_storage: 'In Storage',
  in_vehicle: 'In Vehicle',
  installed: 'Installed',
  cancelled: 'Cancelled',
};

const PART_STATUS_COLORS = {
  pending: 'bg-gray-100 text-gray-800',
  on_order: 'bg-amber-100 text-amber-800',
  in_transit: 'bg-purple-100 text-purple-800',
  in_loading_bay: 'bg-orange-100 text-orange-800',
  in_storage: 'bg-green-100 text-green-800',
  in_vehicle: 'bg-indigo-100 text-indigo-800',
  installed: 'bg-teal-100 text-teal-800',
  cancelled: 'bg-red-100 text-red-800',
};

// ============================================================================
// TASK STATUS
// ============================================================================

export const TASK_STATUS = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

const TASK_STATUS_LABELS = {
  todo: 'To Do',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const TASK_STATUS_COLORS = {
  todo: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

// ============================================================================
// QUOTE STATUS
// ============================================================================

export const QUOTE_STATUS = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  VIEWED: 'Viewed',
  APPROVED: 'Approved',
  DECLINED: 'Declined',
  EXPIRED: 'Expired',
};

const QUOTE_STATUS_LABELS = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  approved: 'Approved',
  declined: 'Declined',
  expired: 'Expired',
};

const QUOTE_STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-800',
  sent: 'bg-blue-100 text-blue-800',
  viewed: 'bg-purple-100 text-purple-800',
  approved: 'bg-green-100 text-green-800',
  declined: 'bg-red-100 text-red-800',
  expired: 'bg-orange-100 text-orange-800',
};

// ============================================================================
// EMAIL THREAD STATUS
// ============================================================================

export const EMAIL_STATUS = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  CLOSED: 'Closed',
  ARCHIVED: 'Archived',
};

const EMAIL_STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In Progress',
  closed: 'Closed',
  archived: 'Archived',
};

const EMAIL_STATUS_COLORS = {
  open: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-amber-100 text-amber-800',
  closed: 'bg-green-100 text-green-800',
  archived: 'bg-gray-100 text-gray-800',
};

// ============================================================================
// SAMPLE STATUS
// ============================================================================

export const SAMPLE_STATUS = {
  AVAILABLE: 'available',
  AT_CLIENT: 'at_client',
  IN_VEHICLE: 'in_vehicle',
  UNAVAILABLE: 'unavailable',
};

const SAMPLE_STATUS_LABELS = {
  available: 'Available',
  at_client: 'At Client',
  in_vehicle: 'In Vehicle',
  unavailable: 'Unavailable',
};

const SAMPLE_STATUS_COLORS = {
  available: 'bg-green-100 text-green-800',
  at_client: 'bg-blue-100 text-blue-800',
  in_vehicle: 'bg-indigo-100 text-indigo-800',
  unavailable: 'bg-gray-100 text-gray-800',
};

// ============================================================================
// INVOICE STATUS
// ============================================================================

export const INVOICE_STATUS = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  CANCELLED: 'Cancelled',
};

const INVOICE_STATUS_LABELS = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
};

const INVOICE_STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-800',
  sent: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

// ============================================================================
// REGISTRY CONSOLIDATION
// ============================================================================

export const STATUS_LABELS = {
  job: JOB_STATUS_LABELS,
  project: PROJECT_STATUS_LABELS,
  po: PO_STATUS_LABELS,
  purchase_order: PO_STATUS_LABELS,
  part: PART_STATUS_LABELS,
  task: TASK_STATUS_LABELS,
  quote: QUOTE_STATUS_LABELS,
  email: EMAIL_STATUS_LABELS,
  email_thread: EMAIL_STATUS_LABELS,
  sample: SAMPLE_STATUS_LABELS,
  invoice: INVOICE_STATUS_LABELS,
};

export const STATUS_COLORS = {
  job: JOB_STATUS_COLORS,
  project: PROJECT_STATUS_COLORS,
  po: PO_STATUS_COLORS,
  purchase_order: PO_STATUS_COLORS,
  part: PART_STATUS_COLORS,
  task: TASK_STATUS_COLORS,
  quote: QUOTE_STATUS_COLORS,
  email: EMAIL_STATUS_COLORS,
  email_thread: EMAIL_STATUS_COLORS,
  sample: SAMPLE_STATUS_COLORS,
  invoice: INVOICE_STATUS_COLORS,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get display label for a status
 * @param {string} entityType - Entity type (job, project, po, etc.)
 * @param {string} status - Status value
 * @returns {string} Display label
 */
export function getStatusLabel(entityType, status) {
  if (!entityType || !status) return '';
  
  const normalizedType = normalizeStatus(entityType);
  const normalizedStatus = normalizeStatus(status);
  
  const labels = STATUS_LABELS[normalizedType];
  if (!labels) return String(status);
  
  return labels[normalizedStatus] || labels[status] || String(status);
}

/**
 * Get color class for a status badge
 * @param {string} entityType - Entity type (job, project, po, etc.)
 * @param {string} status - Status value
 * @returns {string} Tailwind color classes
 */
export function getStatusColor(entityType, status) {
  if (!entityType || !status) return 'bg-gray-100 text-gray-800';
  
  const normalizedType = normalizeStatus(entityType);
  const normalizedStatus = normalizeStatus(status);
  
  const colors = STATUS_COLORS[normalizedType];
  if (!colors) return 'bg-gray-100 text-gray-800';
  
  return colors[normalizedStatus] || colors[status] || 'bg-gray-100 text-gray-800';
}

// ============================================================================
// ENTITY-SPECIFIC EXPORTS (for backward compatibility)
// ============================================================================

export default {
  // Enums
  JOB_STATUS,
  PROJECT_STAGE,
  PO_STATUS,
  PART_STATUS,
  TASK_STATUS,
  QUOTE_STATUS,
  EMAIL_STATUS,
  SAMPLE_STATUS,
  INVOICE_STATUS,
  
  // Registries
  STATUS_LABELS,
  STATUS_COLORS,
  
  // Functions
  normalizeStatus,
  getStatusLabel,
  getStatusColor,
};