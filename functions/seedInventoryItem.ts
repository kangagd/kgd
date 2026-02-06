import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Admin-only Inventory Seed Tool
 * Seeds initial stock via StockMovement (never direct balance manipulation)
 * IDEMPOTENT: Checks for existing seed before creating duplicate
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        // Admin-only
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const { 
            catalog_item_id,
            catalog_item_code, // SKU - preferred for CSV imports
            quantity, 
            to_location_id,
            location_code, // Location code - preferred for CSV imports
            note,
            force = false // Allow override for duplicate seeds
        } = await req.json();

        // Validation
        if (!quantity || quantity <= 0) {
            return Response.json({ error: 'quantity must be positive' }, { status: 400 });
        }

        // Resolve catalog item (by SKU first, then ID)
        let catalogItem = null;
        let resolvedCatalogId = catalog_item_id;

        if (catalog_item_code) {
            // Prefer SKU lookup (case-insensitive)
            const allItems = await base44.asServiceRole.entities.PriceListItem.list();
            catalogItem = allItems.find(item => 
                item.sku && item.sku.toLowerCase().trim() === catalog_item_code.toLowerCase().trim()
            );
            if (!catalogItem) {
                return Response.json({ 
                    error: `No catalog item found with SKU: ${catalog_item_code}` 
                }, { status: 404 });
            }
            resolvedCatalogId = catalogItem.id;
        } else if (catalog_item_id) {
            // Fallback to ID lookup
            catalogItem = await base44.asServiceRole.entities.PriceListItem.get(catalog_item_id);
            if (!catalogItem) {
                return Response.json({ error: 'Catalog item not found' }, { status: 404 });
            }
        } else {
            return Response.json({ 
                error: 'Either catalog_item_id or catalog_item_code required' 
            }, { status: 400 });
        }

        // Resolve location (by code first, then ID)
        let location = null;
        let resolvedLocationId = to_location_id;

        if (location_code) {
            const allLocations = await base44.asServiceRole.entities.InventoryLocation.list();
            location = allLocations.find(loc => loc.location_code === location_code);
            if (!location) {
                return Response.json({ 
                    error: `No location found with code: ${location_code}` 
                }, { status: 404 });
            }
            resolvedLocationId = location.id;
        } else if (to_location_id) {
            location = await base44.asServiceRole.entities.InventoryLocation.get(to_location_id);
            if (!location) {
                return Response.json({ error: 'Location not found' }, { status: 404 });
            }
        } else {
            return Response.json({ 
                error: 'Either to_location_id or location_code required' 
            }, { status: 400 });
        }

        if (!catalogItem) {
            return Response.json({ error: 'Catalog item not found' }, { status: 404 });
        }
        if (!location) {
            return Response.json({ error: 'Location not found' }, { status: 404 });
        }

        // GUARDRAIL: Block seeding to LOADING_BAY or CONSUMED
        if (location.location_code === 'LOADING_BAY') {
            return Response.json({ error: 'Cannot seed to LOADING_BAY' }, { status: 400 });
        }
        if (location.location_code === 'CONSUMED') {
            return Response.json({ error: 'Cannot seed to CONSUMED virtual location' }, { status: 400 });
        }

        // Only allow warehouse and vehicle
        if (location.location_type !== 'warehouse' && location.location_type !== 'vehicle') {
            return Response.json({ 
                error: 'Can only seed to warehouse or vehicle locations' 
            }, { status: 400 });
        }

        // GUARDRAIL: Warn if quantity > 50
        const THRESHOLD = 50;
        if (quantity > THRESHOLD && !force) {
            return Response.json({
                warning: `Quantity (${quantity}) exceeds threshold (${THRESHOLD}). Set force=true to confirm.`,
                requires_confirmation: true
            }, { status: 400 });
        }

        // IDEMPOTENCY: Check for existing seed
        const existingSeeds = await base44.asServiceRole.entities.StockMovement.filter({
            catalog_item_id: resolvedCatalogId,
            to_location_id: resolvedLocationId,
            source_type: 'initial_seed'
        });

        if (existingSeeds.length > 0 && !force) {
            return Response.json({
                warning: `Item already seeded to this location (${existingSeeds.length} seed movements found). Set force=true to seed again.`,
                requires_confirmation: true,
                existing_seeds: existingSeeds.map(s => ({
                    id: s.id,
                    qty: s.qty,
                    created_date: s.created_date
                }))
            }, { status: 400 });
        }

        // Create StockMovement with canonical cached fields
        const movement = await base44.asServiceRole.entities.StockMovement.create({
            catalog_item_id: resolvedCatalogId,
            catalog_item_name: catalogItem.item,  // CANONICAL: .item
            catalog_item_code: catalogItem.sku,   // CANONICAL: .sku
            qty: quantity,
            from_location_id: null,
            to_location_id: resolvedLocationId,
            to_location_code: location.location_code,
            source_type: 'initial_seed',
            source_note: note || 'Operational seed (SKU-based)',
            created_by_user_id: user.id,
            created_by_name: user.full_name || user.email,
            created_at: new Date().toISOString()
        });

        return Response.json({
            success: true,
            movement_id: movement.id,
            summary: `Seeded ${quantity} x ${catalogItem.item} to ${location.location_code}`
        });

    } catch (error) {
        console.error('[seedInventoryItem] Error:', error);
        return Response.json({ 
            error: error.message,
            success: false
        }, { status: 500 });
    }
});