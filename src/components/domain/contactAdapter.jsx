/**
 * Contact Data Adapter
 * Pure functions to transform Contact data (Customer, ProjectContact, JobContact) from database format to UI format
 * 
 * Date normalization: ISO strings (YYYY-MM-DD or ISO 8601)
 * ID normalization: strings
 * Safe defaults: '', [], null to prevent UI crashes
 */

import { toId } from '../utils/id';

/**
 * Transform Customer from database format to UI format
 * @param {Object} customer - Customer from database
 * @returns {Object} UI-formatted customer
 */
export function customerDbToUi(customer) {
  if (!customer) return null;

  return {
    id: toId(customer.id),
    name: customer.name || '',
    customerType: customer.customer_type || '',
    spNumber: customer.sp_number || '',
    source: customer.source || '',
    sourceDetails: customer.source_details || '',
    
    // Contact info
    phone: customer.phone || '',
    email: customer.email || '',
    secondaryPhone: customer.secondary_phone || '',
    
    // Address fields
    addressFull: customer.address_full || '',
    addressStreet: customer.address_street || '',
    addressSuburb: customer.address_suburb || '',
    addressState: customer.address_state || '',
    addressPostcode: customer.address_postcode || '',
    addressCountry: customer.address_country || 'Australia',
    googlePlaceId: customer.google_place_id || '',
    latitude: customer.latitude || null,
    longitude: customer.longitude || null,
    
    // Additional info
    notes: customer.notes || '',
    status: customer.status || 'active',
    
    // Organization
    organisationId: toId(customer.organisation_id),
    organisationName: customer.organisation_name || '',
    
    // Integration
    xeroContactId: customer.xero_contact_id || '',
    
    // Duplicate detection
    normalizedName: customer.normalized_name || '',
    normalizedEmail: customer.normalized_email || '',
    normalizedPhone: customer.normalized_phone || '',
    normalizedAddress: customer.normalized_address || '',
    isPotentialDuplicate: customer.is_potential_duplicate || false,
    duplicateScore: customer.duplicate_score || 0,
    
    // Special flags
    isStation: customer.is_station || false,
    contractId: toId(customer.contract_id),
    
    // Metadata
    deletedAt: customer.deleted_at || null,
    createdDate: customer.created_date || null,
    updatedDate: customer.updated_date || null,
    createdBy: customer.created_by || '',
  };
}

/**
 * Transform ProjectContact from database format to UI format
 * @param {Object} contact - ProjectContact from database
 * @returns {Object} UI-formatted contact
 */
export function projectContactDbToUi(contact) {
  if (!contact) return null;

  return {
    id: toId(contact.id),
    projectId: toId(contact.project_id),
    name: contact.name || '',
    role: contact.role || '',
    phone: contact.phone || '',
    email: contact.email || '',
    isPrimary: contact.is_primary || false,
    notes: contact.notes || '',
    
    // Metadata
    createdDate: contact.created_date || null,
    updatedDate: contact.updated_date || null,
    createdBy: contact.created_by || '',
  };
}

/**
 * Transform JobContact from database format to UI format
 * @param {Object} contact - JobContact from database
 * @returns {Object} UI-formatted contact
 */
export function jobContactDbToUi(contact) {
  if (!contact) return null;

  return {
    id: toId(contact.id),
    jobId: toId(contact.job_id),
    name: contact.name || '',
    role: contact.role || '',
    phone: contact.phone || '',
    email: contact.email || '',
    isPrimary: contact.is_primary || false,
    notes: contact.notes || '',
    
    // Metadata
    createdDate: contact.created_date || null,
    updatedDate: contact.updated_date || null,
    createdBy: contact.created_by || '',
  };
}

/**
 * Get display name for customer
 * @param {Object} customer - Customer entity
 * @returns {string} Display name
 */
export function getCustomerDisplayName(customer) {
  if (!customer) return 'Unknown Customer';
  return customer.name || `Customer ${customer.id?.substring(0, 8) || ''}`;
}

/**
 * Get formatted phone number for display
 * @param {string} phone - Phone number
 * @returns {string} Formatted phone
 */
export function formatPhoneNumber(phone) {
  if (!phone) return '';
  
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Australian mobile format: 04XX XXX XXX
  if (cleaned.length === 10 && cleaned.startsWith('04')) {
    return `${cleaned.substring(0, 4)} ${cleaned.substring(4, 7)} ${cleaned.substring(7)}`;
  }
  
  // Australian landline format: (0X) XXXX XXXX
  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 6)} ${cleaned.substring(6)}`;
  }
  
  // Return original if format doesn't match
  return phone;
}

/**
 * Check if customer is a business/organization
 * @param {Object} customer - Customer entity
 * @returns {boolean} True if business customer
 */
export function isBusinessCustomer(customer) {
  if (!customer) return false;
  const businessTypes = ['Builder', 'Real Estate - Agent', 'Strata - Agent'];
  return businessTypes.includes(customer.customer_type);
}