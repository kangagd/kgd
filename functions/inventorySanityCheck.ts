import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

/**
 * INVENTORY SANITY CHECK (Admin only)
 *
 * Purpose:
 * - Prove where the data actually is (counts + samples).
 * - Verify baseline seed wrote to the current environment.
 * - Return environment headers to confirm preview vs published.
 *
 * Returns:
 * {
 *   success: true,
 *   env: { functions_version_header, origin_url },
 *   counts: { entity_name: total_count, ... },
 *   samples: { entity_name: [sample records], ... }
 * }
 */

const ENTITIES_TO_CHECK = [
  {
    name: "InventoryQuantity",
    fields: ["id", "price_list_item_id", "location_id", "quantity", "item_name", "location_name"],
  },
  {
    name: "InventoryLocation",
    fields: ["id", "name", "type", "vehicle_id"],
  },
  {
    name: "Vehicle",
    fields: ["id", "name", "status"],
  },
  {
    name: "PriceListItem",
    fields: ["id", "item", "track_inventory", "in_inventory"],
  },
  {
    name: "PurchaseOrderLine",
    fields: ["id", "purchase_order_id", "qty_ordered", "qty_received", "price_list_item_id"],
  },
  {
    name: "StockMovement",
    fields: ["id", "source", "quantity", "from_location_id", "to_location_id", "performed_at"],
  },
  {
    name: "BaselineSeedRun",
    fields: ["id", "seed_batch_id", "executed_at", "total_skus", "total_locations"],
  },
];

const pickFields = (record, fields) => {
  if (!record) return null;
  const result = {};
  for (const field of fields) {
    result[field] = record[field] ?? null;
  }
  return result;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== "admin") {
      return Response.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    // Capture environment headers
    const env = {
      functions_version_header: req.headers.get("Base44-Functions-Version") ?? null,
      origin_url: req.headers.get("X-Origin-URL") ?? null,
    };

    const counts = {};
    const samples = {};

    // Check each entity
    for (const entityConfig of ENTITIES_TO_CHECK) {
      const { name, fields } = entityConfig;

      try {
        // Try to list (max 50 rows)
        const rows = await base44.asServiceRole.entities[name].list({ limit: 50 });

        const totalCount = Array.isArray(rows) ? rows.length : 0;
        counts[name] = totalCount;

        // Extract samples (up to 3 records with requested fields only)
        const sampleRecords = (Array.isArray(rows) ? rows : [])
          .slice(0, 3)
          .map((record) => pickFields(record, fields));

        samples[name] = {
          exists: true,
          count: totalCount,
          samples: sampleRecords,
        };
      } catch (error) {
        // Entity doesn't exist or access denied
        counts[name] = 0;
        samples[name] = {
          exists: false,
          error: String(error?.message || error),
        };
      }
    }

    return Response.json({
      success: true,
      env,
      counts,
      samples,
    });
  } catch (error) {
    console.error("[inventorySanityCheck] Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});