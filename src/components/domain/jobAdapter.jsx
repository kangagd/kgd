/**
 * Job Data Adapter
 * Pure functions to transform Job data from database format to UI format
 * 
 * Date normalization: ISO strings (YYYY-MM-DD or ISO 8601)
 * ID normalization: strings
 * Safe defaults: '', [], null to prevent UI crashes
 */

import { toId } from '../utils/id';

/**
 * Transform Job from database format to UI format
 * @param {Object} job - Job from database
 * @returns {Object} UI-formatted job
 */
export function jobDbToUi(job) {
  if (!job) return null;

  return {
    id: toId(job.id),
    jobNumber: job.job_number || '',
    projectId: toId(job.project_id),
    projectName: job.project_name || '',
    projectNumber: job.project_number || null,
    customerId: toId(job.customer_id),
    customerName: job.customer_name || '',
    customerPhone: job.customer_phone || '',
    customerEmail: job.customer_email || '',
    customerType: job.customer_type || '',
    
    // Address fields
    addressFull: job.address_full || '',
    addressStreet: job.address_street || '',
    addressSuburb: job.address_suburb || '',
    addressState: job.address_state || '',
    addressPostcode: job.address_postcode || '',
    addressCountry: job.address_country || 'Australia',
    googlePlaceId: job.google_place_id || '',
    latitude: job.latitude || null,
    longitude: job.longitude || null,
    
    // Job details
    product: job.product || '',
    jobTypeId: toId(job.job_type_id),
    jobType: job.job_type || job.job_type_name || '',
    jobTypeName: job.job_type_name || job.job_type || '',
    
    // Assignment and scheduling
    assignedTo: job.assigned_to || [],
    assignedToName: job.assigned_to_name || [],
    scheduledDate: job.scheduled_date || null,
    scheduledTime: job.scheduled_time || '',
    expectedDuration: job.expected_duration || null,
    scheduledVisits: job.scheduled_visits || [],
    
    // Status and outcome
    status: job.status || 'Open',
    outcome: job.outcome || '',
    logisticsOutcome: job.logistics_outcome || 'none',
    
    // Notes and documentation
    notes: job.notes || '',
    completionNotes: job.completion_notes || '',
    overview: job.overview || '',
    nextSteps: job.next_steps || '',
    communicationWithClient: job.communication_with_client || '',
    pricingProvided: job.pricing_provided || '',
    additionalInfo: job.additional_info || '',
    
    // Measurements and documents
    measurements: job.measurements || {},
    imageUrls: job.image_urls || [],
    invoiceUrl: job.invoice_url || '',
    otherDocuments: job.other_documents || [],
    
    // Integration IDs
    xeroInvoiceId: toId(job.xero_invoice_id),
    xeroPaymentUrl: job.xero_payment_url || '',
    contractId: toId(job.contract_id),
    organisationId: toId(job.organisation_id),
    
    // Logistics-specific
    vehicleId: toId(job.vehicle_id),
    purchaseOrderId: toId(job.purchase_order_id),
    locationId: toId(job.location_id),
    thirdPartyTradeId: toId(job.third_party_trade_id),
    checkedItems: job.checked_items || {},
    sampleIds: job.sample_ids || [],
    
    // Metadata
    deletedAt: job.deleted_at || null,
    slaAt: job.sla_due_at || null,
    isContractJob: job.is_contract_job || false,
    isPotentialDuplicate: job.is_potential_duplicate || false,
    duplicateScore: job.duplicate_score || 0,
    
    // Timestamps
    createdDate: job.created_date || null,
    updatedDate: job.updated_date || null,
    createdBy: job.created_by || '',
  };
}

/**
 * Get formatted job number for display
 * @param {Object} job - Job entity
 * @returns {string} Display job number
 */
export function getJobDisplayNumber(job) {
  if (!job) return '';
  return job.job_number || `#${job.id?.substring(0, 8) || ''}`;
}

/**
 * Check if job is a logistics job
 * @param {Object} job - Job entity
 * @returns {boolean} True if logistics job
 */
export function isLogisticsJob(job) {
  if (!job) return false;
  return !!(job.purchase_order_id || job.sample_ids?.length > 0);
}