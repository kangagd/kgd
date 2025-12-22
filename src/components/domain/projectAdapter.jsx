/**
 * Project Data Adapter
 * Pure functions to transform Project data from database format to UI format
 * 
 * Date normalization: ISO strings (YYYY-MM-DD or ISO 8601)
 * ID normalization: strings
 * Safe defaults: '', [], null to prevent UI crashes
 */

import { toId } from '../utils/id';

/**
 * Transform Project from database format to UI format
 * @param {Object} project - Project from database
 * @returns {Object} UI-formatted project
 */
export function projectDbToUi(project) {
  if (!project) return null;

  return {
    id: toId(project.id),
    projectNumber: project.project_number || null,
    
    // Customer info
    customerId: toId(project.customer_id),
    customerName: project.customer_name || '',
    customerPhone: project.customer_phone || '',
    customerEmail: project.customer_email || '',
    
    // Basic info
    title: project.title || '',
    description: project.description || '',
    projectType: project.project_type || '',
    
    // Status and dates
    status: project.status || 'Lead',
    lostReason: project.lost_reason || '',
    lostReasonNotes: project.lost_reason_notes || '',
    lostDate: project.lost_date || null,
    openedDate: project.opened_date || null,
    completedDate: project.completed_date || null,
    
    // Address fields
    addressFull: project.address_full || '',
    addressStreet: project.address_street || '',
    addressSuburb: project.address_suburb || '',
    addressState: project.address_state || '',
    addressPostcode: project.address_postcode || '',
    addressCountry: project.address_country || 'Australia',
    googlePlaceId: project.google_place_id || '',
    latitude: project.latitude || null,
    longitude: project.longitude || null,
    
    // Assignment
    assignedTechnicians: project.assigned_technicians || [],
    assignedTechniciansNames: project.assigned_technicians_names || [],
    
    // Documents and notes
    notes: project.notes || '',
    imageUrls: project.image_urls || [],
    invoiceUrl: project.invoice_url || '',
    otherDocuments: project.other_documents || [],
    
    // Door specifications
    doors: project.doors || [],
    
    // Financial (admin only fields)
    totalProjectValue: project.total_project_value || null,
    materialsCost: project.materials_cost || null,
    labourCost: project.labour_cost || null,
    otherCosts: project.other_costs || null,
    financialStatus: project.financial_status || '',
    financialStatusLocked: project.financial_status_locked || false,
    financialValueLocked: project.financial_value_locked || false,
    financialNotes: project.financial_notes || '',
    payments: project.payments || [],
    
    // Integrations
    xeroInvoices: project.xero_invoices || [],
    xeroPaymentUrl: project.xero_payment_url || '',
    primaryQuoteId: toId(project.primary_quote_id),
    primaryXeroInvoiceId: toId(project.primary_xero_invoice_id),
    pipedriveId: project.pipedrive_deal_id || '',
    legacyXeroInvoiceUrl: project.legacy_xero_invoice_url || '',
    legacyPandadocUrl: project.legacy_pandadoc_url || '',
    
    // Warranty
    warrantyEnabled: project.warranty_enabled !== false,
    warrantyStartDate: project.warranty_start_date || null,
    warrantyEndDate: project.warranty_end_date || null,
    warrantyDurationMonths: project.warranty_duration_months || 12,
    warrantyStatus: project.warranty_status || '',
    
    // Email thread linkage
    sourceEmailThreadId: toId(project.source_email_thread_id),
    
    // Duplicate detection
    normalizedTitle: project.normalized_title || '',
    normalizedAddress: project.normalized_address || '',
    isPotentialDuplicate: project.is_potential_duplicate || false,
    duplicateScore: project.duplicate_score || 0,
    
    // Initial visit
    initialVisitJobId: toId(project.initial_visit_job_id),
    initialVisitOverview: project.initial_visit_overview || '',
    initialVisitNextSteps: project.initial_visit_next_steps || '',
    initialVisitCustomerCommunication: project.initial_visit_customer_communication || '',
    initialVisitMeasurements: project.initial_visit_measurements || {},
    initialVisitImageUrls: project.initial_visit_image_urls || [],
    initialVisitOutcome: project.initial_visit_outcome || '',
    initialVisitCompletedAt: project.initial_visit_completed_at || null,
    initialVisitTechnicianName: project.initial_visit_technician_name || '',
    
    // Organization
    contractId: toId(project.contract_id),
    organisationId: toId(project.organisation_id),
    
    // Activity tracking
    lastActivityAt: project.last_activity_at || null,
    lastActivityType: project.last_activity_type || '',
    
    // Handover
    handoverPdfUrl: project.handover_pdf_url || '',
    handoverGeneratedAt: project.handover_generated_at || null,
    handoverGeneratedBy: project.handover_generated_by || '',
    handoverLocked: project.handover_locked || false,
    
    // Metadata
    deletedAt: project.deleted_at || null,
    createdDate: project.created_date || null,
    updatedDate: project.updated_date || null,
    createdBy: project.created_by || '',
  };
}

/**
 * Get formatted project reference for display
 * @param {Object} project - Project entity
 * @returns {string} Display reference
 */
export function getProjectDisplayReference(project) {
  if (!project) return '';
  if (project.project_number) return `#${project.project_number}`;
  return project.title || `Project ${project.id?.substring(0, 8) || ''}`;
}

/**
 * Check if project is in active stages
 * @param {Object} project - Project entity
 * @returns {boolean} True if active
 */
export function isActiveProject(project) {
  if (!project) return false;
  const inactiveStatuses = ['Lost', 'Completed', 'Cancelled'];
  return !inactiveStatuses.includes(project.status);
}