import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Guard 1: Admin only
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Guard 2: Preview only (check origin URL for "preview" subdomain)
    const originUrl = req.headers.get('origin') || req.headers.get('referer') || '';
    const isPreview = originUrl.includes('preview-sandbox') || originUrl.includes('preview');
    if (!isPreview) {
      return Response.json({ 
        error: 'Refusing to run outside preview environment',
        origin: originUrl 
      }, { status: 400 });
    }

    // Initialize result tracker
    const result = {
      created: {},
      updated: {},
      summary: '',
      key_ids: {}
    };

    // ============================================
    // 1. CREATE WAREHOUSE LOCATION
    // ============================================
    const warehouseLocations = await base44.entities.InventoryLocation.filter({
      type: 'warehouse',
      name: 'Main Warehouse (Waterloo)'
    });

    let warehouseLocation;
    if (warehouseLocations.length === 0) {
      warehouseLocation = await base44.entities.InventoryLocation.create({
        type: 'warehouse',
        name: 'Main Warehouse (Waterloo)',
        is_active: true
      });
      result.created.warehouse_location = 1;
    } else {
      warehouseLocation = warehouseLocations[0];
      result.updated.warehouse_location = 1;
    }
    result.key_ids.warehouse_location_id = warehouseLocation.id;

    // ============================================
    // 2. CREATE VEHICLES & VEHICLE LOCATIONS
    // ============================================
    const vehicleNames = ['Wrapped Small Logo', 'Wrapped Full Logo', 'OG Ute'];
    const vehicleIds = [];
    const vehicleLocationIds = [];
    result.created.vehicles = 0;
    result.updated.vehicles = 0;
    result.created.vehicle_locations = 0;
    result.updated.vehicle_locations = 0;

    for (const name of vehicleNames) {
      // Find or create vehicle
      const existingVehicles = await base44.entities.Vehicle.filter({ name });
      let vehicle;
      if (existingVehicles.length === 0) {
        vehicle = await base44.entities.Vehicle.create({ name });
        result.created.vehicles += 1;
      } else {
        vehicle = existingVehicles[0];
        result.updated.vehicles += 1;
      }
      vehicleIds.push(vehicle.id);

      // Find or create vehicle location
      const existingVehicleLocations = await base44.entities.InventoryLocation.filter({
        type: 'vehicle',
        vehicle_id: vehicle.id
      });
      let vehicleLocation;
      if (existingVehicleLocations.length === 0) {
        vehicleLocation = await base44.entities.InventoryLocation.create({
          type: 'vehicle',
          vehicle_id: vehicle.id,
          name: `${name} (Vehicle Stock)`,
          is_active: true
        });
        result.created.vehicle_locations += 1;
      } else {
        vehicleLocation = existingVehicleLocations[0];
        result.updated.vehicle_locations += 1;
      }
      vehicleLocationIds.push(vehicleLocation.id);
    }
    result.key_ids.vehicle_ids = vehicleIds;
    result.key_ids.vehicle_location_ids = vehicleLocationIds;

    // ============================================
    // 3. CREATE PRICE LIST ITEMS (SKUs)
    // ============================================
    const skuData = [
      { item: 'Merlin 2.0 Receiver', sku: 'Merlin-Receiver-2.0', category: 'Accessories', unit_cost: 45.00, price: 89.00 },
      { item: '4Ddoors Nano Receiver', sku: '4D-Receiver-Nano', category: 'Accessories', unit_cost: 52.00, price: 104.00 },
      { item: 'CodeEzy Safety Beams', sku: 'CodeEzy-Safety-Beams', category: 'Accessories', unit_cost: 18.50, price: 37.00 },
      { item: 'Merlin Belt Rail (Long)', sku: 'Merlin-BeltRail-Long', category: 'Rails', unit_cost: 22.00, price: 44.00 },
      { item: 'Merlin Belt Rail (Short)', sku: 'Merlin-BeltRail-Short', category: 'Rails', unit_cost: 20.00, price: 40.00 },
      { item: 'Merlin Commander Elite Motor', sku: 'Merlin-Commander-Elite', category: 'Motor', unit_cost: 125.00, price: 250.00 },
      { item: 'Merlin SilentDrive Elite Motor', sku: 'Merlin-SilentDrive-Elite', category: 'Motor', unit_cost: 140.00, price: 280.00 },
      { item: 'MyQ WiFi Kit', sku: 'MyQ-WiFi-Kit', category: 'Accessories', unit_cost: 35.00, price: 70.00 }
    ];

    const priceListItemIds = {};
    result.created.price_list_items = 0;
    result.updated.price_list_items = 0;

    for (const sku of skuData) {
      // Find by SKU or item name
      const existing = await base44.asServiceRole.entities.PriceListItem.filter({
        sku: sku.sku
      });

      let item;
      if (existing.length === 0) {
        item = await base44.asServiceRole.entities.PriceListItem.create({
          item: sku.item,
          sku: sku.sku,
          category: sku.category,
          unit_cost: sku.unit_cost,
          price: sku.price,
          track_inventory: true,
          in_inventory: true,
          stock_level: 0,
          min_stock_level: 2,
          is_active: true
        });
        result.created.price_list_items += 1;
      } else {
        item = existing[0];
        result.updated.price_list_items += 1;
      }
      priceListItemIds[sku.sku] = item.id;
    }
    result.key_ids.price_list_item_ids = priceListItemIds;

    // ============================================
    // 4. CREATE BASELINE INVENTORY QUANTITIES
    // ============================================
    const baselineData = [
      { sku: 'Merlin-Receiver-2.0', warehouse: 5, vehicles: [1, 1, 0] },
      { sku: '4D-Receiver-Nano', warehouse: 3, vehicles: [0, 0, 0] },
      { sku: 'CodeEzy-Safety-Beams', warehouse: 8, vehicles: [1, 0, 1] },
      { sku: 'Merlin-BeltRail-Long', warehouse: 4, vehicles: [0, 0, 0] },
      { sku: 'Merlin-BeltRail-Short', warehouse: 4, vehicles: [0, 0, 0] },
      { sku: 'Merlin-Commander-Elite', warehouse: 2, vehicles: [0, 0, 0] },
      { sku: 'Merlin-SilentDrive-Elite', warehouse: 2, vehicles: [0, 0, 0] },
      { sku: 'MyQ-WiFi-Kit', warehouse: 6, vehicles: [0, 1, 0] }
    ];

    result.created.inventory_quantities = 0;
    result.updated.inventory_quantities = 0;
    result.created.stock_movements = 0;

    for (const baseline of baselineData) {
      const itemId = priceListItemIds[baseline.sku];
      if (!itemId) continue;

      // Warehouse quantity
      const warehouseQtyExisting = await base44.asServiceRole.entities.InventoryQuantity.filter({
        price_list_item_id: itemId,
        location_id: warehouseLocation.id
      });

      if (warehouseQtyExisting.length === 0) {
        await base44.asServiceRole.entities.InventoryQuantity.create({
          price_list_item_id: itemId,
          location_id: warehouseLocation.id,
          quantity_on_hand: baseline.warehouse
        });
        result.created.inventory_quantities += 1;

        // Create stock movement for audit
        await base44.asServiceRole.entities.StockMovement.create({
          price_list_item_id: itemId,
          item_name: skuData.find(s => s.sku === baseline.sku)?.item,
          from_location_id: warehouseLocation.id,
          from_location_name: warehouseLocation.name,
          to_location_id: warehouseLocation.id,
          to_location_name: warehouseLocation.name,
          quantity: baseline.warehouse,
          source: 'manual_adjustment',
          performed_by_user_email: user.email,
          performed_by_user_name: user.full_name || user.email,
          performed_at: new Date().toISOString(),
          notes: 'Preview bootstrap baseline initialization'
        });
        result.created.stock_movements += 1;
      } else {
        result.updated.inventory_quantities += 1;
      }

      // Vehicle quantities
      for (let i = 0; i < vehicleLocationIds.length; i++) {
        const qty = baseline.vehicles[i] || 0;
        if (qty === 0) continue;

        const vehicleQtyExisting = await base44.asServiceRole.entities.InventoryQuantity.filter({
          price_list_item_id: itemId,
          location_id: vehicleLocationIds[i]
        });

        if (vehicleQtyExisting.length === 0) {
          await base44.asServiceRole.entities.InventoryQuantity.create({
            price_list_item_id: itemId,
            location_id: vehicleLocationIds[i],
            quantity_on_hand: qty
          });
          result.created.inventory_quantities += 1;

          // Create stock movement
          await base44.asServiceRole.entities.StockMovement.create({
            price_list_item_id: itemId,
            item_name: skuData.find(s => s.sku === baseline.sku)?.item,
            from_location_id: vehicleLocationIds[i],
            from_location_name: `${vehicleNames[i]} (Vehicle Stock)`,
            to_location_id: vehicleLocationIds[i],
            to_location_name: `${vehicleNames[i]} (Vehicle Stock)`,
            quantity: qty,
            source: 'manual_adjustment',
            performed_by_user_email: user.email,
            performed_by_user_name: user.full_name || user.email,
            performed_at: new Date().toISOString(),
            notes: 'Preview bootstrap baseline initialization'
          });
          result.created.stock_movements += 1;
        } else {
          result.updated.inventory_quantities += 1;
        }
      }
    }

    // ============================================
    // 5. OPTIONAL: CREATE DEMO PURCHASE ORDER
    // ============================================
    result.created.purchase_orders = 0;
    result.created.purchase_order_lines = 0;

    // Find or create a demo supplier
    const suppliers = await base44.asServiceRole.entities.Supplier.filter({ name: 'Demo Supplier' });
    let supplierId;
    if (suppliers.length === 0) {
      const supplier = await base44.asServiceRole.entities.Supplier.create({
        name: 'Demo Supplier',
        email: 'demo@supplier.local',
        phone: '1800-DEMO-PO'
      });
      supplierId = supplier.id;
    } else {
      supplierId = suppliers[0].id;
    }

    // Check if demo PO already exists
    const demoPOs = await base44.asServiceRole.entities.PurchaseOrder.filter({
      supplier_id: supplierId,
      notes: 'Preview demo purchase order'
    });

    if (demoPOs.length === 0) {
      const po = await base44.asServiceRole.entities.PurchaseOrder.create({
        supplier_id: supplierId,
        supplier_name: 'Demo Supplier',
        po_number: `DEMO-${Date.now()}`,
        status: 'sent',
        notes: 'Preview demo purchase order',
        expected_delivery_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      });

      result.created.purchase_orders = 1;
      result.key_ids.demo_po_id = po.id;

      // Add PO lines
      const poLines = [
        { sku: 'Merlin-Receiver-2.0', qty: 10 },
        { sku: 'CodeEzy-Safety-Beams', qty: 15 }
      ];

      for (const line of poLines) {
        const itemId = priceListItemIds[line.sku];
        if (!itemId) continue;

        await base44.asServiceRole.entities.PurchaseOrderLine.create({
          purchase_order_id: po.id,
          price_list_item_id: itemId,
          item_name: skuData.find(s => s.sku === line.sku)?.item,
          qty_ordered: line.qty,
          qty_received: 0
        });

        result.created.purchase_order_lines += 1;
      }
    }

    // ============================================
    // RETURN RESULT
    // ============================================
    result.success = true;
    result.summary = 'Preview bootstrap seeded successfully';

    return Response.json(result);
  } catch (error) {
    console.error('seedPreviewBootstrapData error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});