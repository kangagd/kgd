import React, { useState, useEffect, useQuery } from "react";
import StockAdjustmentAdminModal from "@/components/inventory/StockAdjustmentAdminModal";

/**
 * BACKWARD COMPATIBILITY WRAPPER
 * Old StockAdjustmentModal wraps new StockAdjustmentAdminModal
 * Used by: MyVehicle, other vehicle-based adjustments
 */

export default function StockAdjustmentModal({ open, onClose, item, vehicleId }) {
  const [locationId, setLocationId] = useState(null);
  const [locationName, setLocationName] = useState(null);

  // Get vehicle location
  useEffect(() => {
    if (open && vehicleId && item) {
      (async () => {
        try {
          const { base44 } = await import("@/api/base44Client");
          const locations = await base44.entities.InventoryLocation.filter({
            type: 'vehicle',
            vehicle_id: vehicleId
          });
          if (locations.length > 0) {
            setLocationId(locations[0].id);
            setLocationName(locations[0].name);
          }
        } catch (err) {
          console.error('Failed to fetch vehicle location:', err);
        }
      })();
    }
  }, [open, vehicleId, item]);

  if (!item) return null;

  return (
    <StockAdjustmentAdminModal
      open={open}
      onClose={onClose}
      skuId={item.product_id}
      skuName={item.product_name}
      locationId={locationId}
      locationName={locationName}
      currentQuantity={item.quantity_on_hand}
    />
  );
}