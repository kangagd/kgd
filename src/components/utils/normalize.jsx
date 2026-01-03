// Normalization utilities for duplicate detection

export function normalizeString(str) {
  if (!str) return '';
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

export function normalizePhone(phone) {
  if (!phone) return '';
  return phone.replace(/[\s\+\(\)\-\.]/g, '');
}

export function normalizeAddress(record) {
  const parts = [
    record.address_street,
    record.address_suburb,
    record.address_state,
    record.address_postcode,
    record.address_full,
    record.address
  ].filter(Boolean);
  
  return normalizeString(parts.join(' '));
}

export function getNormalizedFields(entityType, data) {
  const normalized = {};
  
  if (entityType === 'Customer' || entityType === 'Organisation') {
    normalized.normalized_name = normalizeString(data.name);
    normalized.normalized_email = data.email ? data.email.toLowerCase().trim() : null;
    normalized.normalized_phone = normalizePhone(data.phone);
  }
  
  if (entityType === 'Customer') {
    normalized.normalized_address = normalizeAddress(data);
  }
  
  if (entityType === 'Project') {
    normalized.normalized_title = normalizeString(data.title);
    normalized.normalized_address = normalizeAddress(data);
  }
  
  if (entityType === 'Job') {
    normalized.normalized_address = normalizeAddress(data);
  }
  
  return normalized;
}