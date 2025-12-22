/**
 * Vehicle Data Adapter
 * Pure functions to transform Vehicle data from database format to UI format
 * 
 * Date normalization: ISO strings (YYYY-MM-DD or ISO 8601)
 * ID normalization: strings
 * Safe defaults: '', [], null to prevent UI crashes
 */

import { toId } from '../utils/id';

/**
 * Transform Vehicle from database format to UI format
 * @param {Object} vehicle - Vehicle from database
 * @returns {Object} UI-formatted vehicle
 */
export function vehicleDbToUi(vehicle) {
  if (!vehicle) return null;

  return {
    id: toId(vehicle.id),
    name: vehicle.name || '',
    registration: vehicle.registration || '',
    make: vehicle.make || '',
    model: vehicle.model || '',
    year: vehicle.year || null,
    color: vehicle.color || '',
    vin: vehicle.vin || '',
    
    // Assignment
    assignedTo: vehicle.assigned_to || '',
    assignedToName: vehicle.assigned_to_name || '',
    
    // Status
    status: vehicle.status || 'active',
    isActive: vehicle.is_active !== false,
    
    // Tracking
    currentLocation: vehicle.current_location || '',
    lastKnownLocation: vehicle.last_known_location || '',
    odometerReading: vehicle.odometer_reading || null,
    
    // Maintenance
    nextServiceDate: vehicle.next_service_date || null,
    nextServiceOdometer: vehicle.next_service_odometer || null,
    registrationExpiryDate: vehicle.registration_expiry_date || null,
    insuranceExpiryDate: vehicle.insurance_expiry_date || null,
    
    // Documentation
    notes: vehicle.notes || '',
    imageUrls: vehicle.image_urls || [],
    documents: vehicle.documents || [],
    
    // Metadata
    createdDate: vehicle.created_date || null,
    updatedDate: vehicle.updated_date || null,
    createdBy: vehicle.created_by || '',
  };
}

/**
 * Get display name for vehicle
 * @param {Object} vehicle - Vehicle entity
 * @returns {string} Display name
 */
export function getVehicleDisplayName(vehicle) {
  if (!vehicle) return 'Unknown Vehicle';
  
  if (vehicle.name) return vehicle.name;
  
  // Build from make/model if available
  const parts = [];
  if (vehicle.make) parts.push(vehicle.make);
  if (vehicle.model) parts.push(vehicle.model);
  if (parts.length > 0) return parts.join(' ');
  
  // Fallback to registration
  if (vehicle.registration) return vehicle.registration;
  
  return `Vehicle ${vehicle.id?.substring(0, 8) || ''}`;
}

/**
 * Check if vehicle is assigned to a specific user
 * @param {Object} vehicle - Vehicle entity
 * @param {string} userEmail - User email to check
 * @returns {boolean} True if assigned
 */
export function isVehicleAssignedTo(vehicle, userEmail) {
  if (!vehicle || !userEmail) return false;
  return vehicle.assigned_to === userEmail;
}

/**
 * Check if vehicle needs maintenance
 * @param {Object} vehicle - Vehicle entity
 * @returns {boolean} True if maintenance due soon
 */
export function needsMaintenance(vehicle) {
  if (!vehicle) return false;
  
  const now = new Date();
  const warningDays = 30; // 30 days warning
  
  // Check service date
  if (vehicle.next_service_date) {
    const serviceDate = new Date(vehicle.next_service_date);
    const daysUntilService = Math.ceil((serviceDate - now) / (1000 * 60 * 60 * 24));
    if (daysUntilService <= warningDays) return true;
  }
  
  // Check registration expiry
  if (vehicle.registration_expiry_date) {
    const expiryDate = new Date(vehicle.registration_expiry_date);
    const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry <= warningDays) return true;
  }
  
  // Check insurance expiry
  if (vehicle.insurance_expiry_date) {
    const expiryDate = new Date(vehicle.insurance_expiry_date);
    const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry <= warningDays) return true;
  }
  
  return false;
}