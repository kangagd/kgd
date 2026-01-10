
// Warehouse locations
export const WAREHOUSE_LOCATION = {
  WAREHOUSE: "warehouse",
  VEHICLE: "vehicle",
};

// Stock movement types
export const STOCK_MOVEMENT_TYPE = {
  TRANSFER: "transfer",
  STOCK_IN: "stock_in",
  STOCK_OUT: "stock_out",
  ADJUSTMENT: "adjustment",
  JOB_USAGE: "job_usage",
};

// Deprecated - use WAREHOUSE_LOCATION instead
export const LOCATION_TYPE = WAREHOUSE_LOCATION;

// Deprecated - use STOCK_MOVEMENT_TYPE instead
export const MOVEMENT_TYPE = STOCK_MOVEMENT_TYPE;
