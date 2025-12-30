/**
 * Sample Configuration
 * Central source of truth for Sample location types, statuses, and movement types
 * 
 * ⚠️ MIGRATION NOTICE:
 * - SampleV2 → Sample (completed)
 * - SampleMovementV2 → SampleMovement (completed)
 * 
 * DO NOT recreate V2 entities. Use Sample and SampleMovement entities only.
 * All sample mutations must go through manageSample backend function.
 */

export const SAMPLE_LOCATION_TYPE = {
  WAREHOUSE: "Warehouse",
  VEHICLE: "Vehicle",
  WITH_CLIENT: "With Client",
  IN_TRANSIT_DROP_OFF: "In Transit (Drop-Off)",
  IN_TRANSIT_PICKUP: "In Transit (Pickup)",
  LOST: "Lost",
};

export const SAMPLE_LOCATION_TYPE_OPTIONS = Object.values(SAMPLE_LOCATION_TYPE);

export const SAMPLE_STATUS = {
  ACTIVE: "Active",
  MISSING: "Missing",
  RETIRED: "Retired",
};

export const SAMPLE_STATUS_OPTIONS = Object.values(SAMPLE_STATUS);

export const SAMPLE_MOVEMENT_TYPE = {
  CHECK_OUT_TO_VEHICLE: "Check Out to Vehicle",
  DROP_AT_CLIENT: "Drop at Client",
  PICK_UP_FROM_CLIENT: "Pick Up from Client",
  RETURN_TO_WAREHOUSE: "Return to Warehouse",
  REASSIGN_VEHICLE: "Reassign Vehicle",
};

export const SAMPLE_MOVEMENT_TYPE_OPTIONS = Object.values(SAMPLE_MOVEMENT_TYPE);

/**
 * Get a friendly label for a sample location
 * @param {string} location_type - The location type
 * @param {string} location_reference_id - Optional reference ID
 * @param {Object} context - Optional context object with vehicles, projects arrays
 * @returns {string} Friendly location label
 */
export function getSampleLocationLabel(location_type, location_reference_id = null, context = {}) {
  if (!location_type) return "Unknown Location";

  switch (location_type) {
    case SAMPLE_LOCATION_TYPE.WAREHOUSE:
      return "Warehouse";

    case SAMPLE_LOCATION_TYPE.VEHICLE:
      if (location_reference_id && context.vehicles) {
        const vehicle = context.vehicles.find(v => v.id === location_reference_id);
        if (vehicle) {
          return `In ${vehicle.name || vehicle.registration || 'Vehicle'}`;
        }
      }
      return "In Vehicle";

    case SAMPLE_LOCATION_TYPE.WITH_CLIENT:
      if (location_reference_id && context.projects) {
        const project = context.projects.find(p => p.id === location_reference_id);
        if (project) {
          return `With Client – ${project.customer_name || project.title || 'Project'}`;
        }
      }
      return "With Client";

    case SAMPLE_LOCATION_TYPE.IN_TRANSIT_DROP_OFF:
      return "In Transit (Drop-Off)";

    case SAMPLE_LOCATION_TYPE.IN_TRANSIT_PICKUP:
      return "In Transit (Pickup)";

    case SAMPLE_LOCATION_TYPE.LOST:
      return "Lost";

    default:
      return location_type;
  }
}

/**
 * Get status badge color
 * @param {string} status - Sample status
 * @returns {string} Tailwind color classes
 */
export function getSampleStatusColor(status) {
  switch (status) {
    case SAMPLE_STATUS.ACTIVE:
      return "bg-green-100 text-green-700 border-green-200";
    case SAMPLE_STATUS.MISSING:
      return "bg-red-100 text-red-700 border-red-200";
    case SAMPLE_STATUS.RETIRED:
      return "bg-gray-100 text-gray-700 border-gray-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

/**
 * Get location type badge color
 * @param {string} location_type - Sample location type
 * @returns {string} Tailwind color classes
 */
export function getSampleLocationColor(location_type) {
  switch (location_type) {
    case SAMPLE_LOCATION_TYPE.WAREHOUSE:
      return "bg-blue-100 text-blue-700 border-blue-200";
    case SAMPLE_LOCATION_TYPE.VEHICLE:
      return "bg-purple-100 text-purple-700 border-purple-200";
    case SAMPLE_LOCATION_TYPE.WITH_CLIENT:
      return "bg-amber-100 text-amber-700 border-amber-200";
    case SAMPLE_LOCATION_TYPE.IN_TRANSIT_DROP_OFF:
    case SAMPLE_LOCATION_TYPE.IN_TRANSIT_PICKUP:
      return "bg-orange-100 text-orange-700 border-orange-200";
    case SAMPLE_LOCATION_TYPE.LOST:
      return "bg-red-100 text-red-700 border-red-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}