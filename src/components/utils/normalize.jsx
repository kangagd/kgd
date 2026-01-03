// Normalization utilities for duplicate detection

export function normalizeString(str) {
  if (!str) return '';
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

export function normalizePhone(phone) {
  if (!phone) return '';
  
  // Remove all formatting characters
  const digitsOnly = phone.replace(/[\s\+\(\)\-\.]/g, '');
  
  // If it starts with 4 and has 9 digits (Australian mobile without country code)
  if (/^4\d{8}$/.test(digitsOnly)) {
    return '+61' + digitsOnly;
  }
  
  // If it already starts with 61 (country code without +)
  if (/^61\d{9}$/.test(digitsOnly)) {
    return '+' + digitsOnly;
  }
  
  // If it starts with + followed by digits, keep as is
  if (phone.trim().startsWith('+')) {
    return phone.replace(/[\s\(\)\-\.]/g, '');
  }
  
  return digitsOnly;
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