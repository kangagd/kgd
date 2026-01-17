import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * READ-ONLY AUDIT FUNCTION
 * Validates end-to-end inventory, PO, and logistics flows
 * Returns structured PASS/FAIL report with evidence
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only admin can run checkpoint
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Capture environment headers
    const originUrl = req.headers.get('x-origin-url') || 'unknown';
    const functionsVersion = req.headers.get('functions-version') || 'unknown';

    const report = {
      success: true,
      env: { origin_url: originUrl, functions_version: functionsVersion },
      summary: { pass: true, failures: 0, warnings: 0 },
      checks: [],
      failures: [],
      warnings: []
    };

    // ========================================
    // CHECK 1: Entity Presence
    // ========================================
    const check1 = { name: 'Entity Presence', ok: true, notes: '', evidence: {} };
    try {
      const [locations, quantities, vehicles, items, poLines, movements] = await Promise.all([
        base44.asServiceRole.entities.InventoryLocation.list(),
        base44.asServiceRole.entities.InventoryQuantity.list(),
        base44.asServiceRole.entities.Vehicle.list(),
        base44.asServiceRole.entities.PriceListItem.list(),
        base44.asServiceRole.entities.PurchaseOrderLine.list(),
        base44.asServiceRole.entities.StockMovement.list()
      ]);

      check1.evidence = {
        InventoryLocation: locations.length,
        InventoryQuantity: quantities.length,
        Vehicle: vehicles.length,
        PriceListItem: items.length,
        PurchaseOrderLine: poLines.length,
        StockMovement: movements.length
      };

      if (Object.values(check1.evidence).every(c => c === 0)) {
        check1.ok = false;
        check1.notes = 'Environment empty or data not seeded';
        report.failures.push('Entity Presence: All counts are zero');
        report.summary.failures++;
      } else if (Object.values(check1.evidence).some(c => c === 0)) {
        report.warnings.push(`Entity Presence: Some entities have zero count: ${JSON.stringify(check1.evidence)}`);
        report.summary.warnings++;
      }
    } catch (err) {
      check1.ok = false;
      check1.notes = `Error fetching entities: ${err.message}`;
      report.failures.push(check1.notes);
      report.summary.failures++;
    }
    report.checks.push(check1);

    // ========================================
    // CHECK 2: Warehouse Sanity
    // ========================================
    const check2 = { name: 'Warehouse Sanity', ok: true, notes: '', evidence: { warehouses: [] } };
    try {
      const warehouses = await base44.asServiceRole.entities.InventoryLocation.filter({
        type: 'warehouse',
        is_active: { $ne: false }
      });

      check2.evidence.warehouses = warehouses.map(w => ({ id: w.id, name: w.name }));

      if (warehouses.length === 0) {
        check2.ok = false;
        check2.notes = 'No active warehouse locations found';
        report.failures.push('Warehouse Sanity: Zero warehouses');
        report.summary.failures++;
      } else if (warehouses.length > 1) {
        report.warnings.push(`Warehouse Sanity: Multiple warehouses exist (${warehouses.length}); expected 1 main`);
        report.summary.warnings++;
      }
    } catch (err) {
      check2.ok = false;
      check2.notes = `Error: ${err.message}`;
      report.failures.push(check2.notes);
      report.summary.failures++;
    }
    report.checks.push(check2);

    // ========================================
    // CHECK 3: Vehicle-Location Mapping Sanity
    // ========================================
    const check3 = { name: 'Vehicle-Location Mapping', ok: true, notes: '', evidence: { total_vehicles: 0, mapped: 0, unmapped: [], multi_mapped: [] } };
    try {
      const vehicles = await base44.asServiceRole.entities.Vehicle.list('', 200);
      const vehicleLocs = await base44.asServiceRole.entities.InventoryLocation.filter({ type: 'vehicle' });

      check3.evidence.total_vehicles = vehicles.length;

      for (const vehicle of vehicles) {
        const locs = vehicleLocs.filter(l => l.vehicle_id === vehicle.id && l.is_active !== false);
        if (locs.length === 0) {
          check3.evidence.unmapped.push(vehicle.id);
          report.warnings.push(`Vehicle ${vehicle.id} (${vehicle.name}) has no active inventory location`);
          report.summary.warnings++;
        } else if (locs.length > 1) {
          check3.evidence.multi_mapped.push(vehicle.id);
          report.warnings.push(`Vehicle ${vehicle.id} has ${locs.length} active locations (expected 1)`);
          report.summary.warnings++;
        } else {
          check3.evidence.mapped++;
        }
      }

      if (check3.evidence.unmapped.length > 0 || check3.evidence.multi_mapped.length > 0) {
        check3.ok = false;
      }
    } catch (err) {
      check3.ok = false;
      check3.notes = `Error: ${err.message}`;
      report.failures.push(check3.notes);
      report.summary.failures++;
    }
    report.checks.push(check3);

    // ========================================
    // CHECK 4: On-Hand Stock Sanity
    // ========================================
    const check4 = { name: 'On-Hand Stock Sanity', ok: true, notes: '', evidence: { total: 0, valid: 0, missing_item_name: [], missing_location_name: [] } };
    try {
      const quantities = await base44.asServiceRole.entities.InventoryQuantity.list();
      check4.evidence.total = quantities.length;

      for (const q of quantities) {
        if (!q.price_list_item_id || !q.location_id) {
          report.failures.push(`InventoryQuantity ${q.id}: missing price_list_item_id or location_id`);
          report.summary.failures++;
          check4.ok = false;
        } else {
          check4.evidence.valid++;
          if (!q.item_name || q.item_name === 'Unknown Item') {
            check4.evidence.missing_item_name.push(q.id);
            report.warnings.push(`InventoryQuantity ${q.id}: missing or placeholder item_name`);
            report.summary.warnings++;
          }
          if (!q.location_name || q.location_name === 'Unknown Location') {
            check4.evidence.missing_location_name.push(q.id);
            report.warnings.push(`InventoryQuantity ${q.id}: missing or placeholder location_name`);
            report.summary.warnings++;
          }
        }
      }
    } catch (err) {
      check4.ok = false;
      check4.notes = `Error: ${err.message}`;
      report.failures.push(check4.notes);
      report.summary.failures++;
    }
    report.checks.push(check4);

    // ========================================
    // CHECK 5: Inbound Calculation Sanity
    // ========================================
    const check5 = { name: 'Inbound Calculation', ok: true, notes: '', evidence: { total_inbound: 0, top_10_by_inbound: [], recent_receipts_7d: 0 } };
    try {
      const poLines = await base44.asServiceRole.entities.PurchaseOrderLine.list();
      
      // Calculate inbound per SKU
      const inboundMap = {};
      for (const line of poLines) {
        const inbound = Math.max(0, (line.qty_ordered || 0) - (line.qty_received || 0));
        if (inbound > 0 && line.price_list_item_id) {
          if (!inboundMap[line.price_list_item_id]) {
            inboundMap[line.price_list_item_id] = { sku_id: line.price_list_item_id, item_name: line.item_name, total_inbound: 0 };
          }
          inboundMap[line.price_list_item_id].total_inbound += inbound;
        }
      }

      check5.evidence.total_inbound = Object.values(inboundMap).reduce((sum, s) => sum + s.total_inbound, 0);
      check5.evidence.top_10_by_inbound = Object.values(inboundMap)
        .sort((a, b) => b.total_inbound - a.total_inbound)
        .slice(0, 10);

      // Check for recent receipts
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const movements = await base44.asServiceRole.entities.StockMovement.filter({ source: 'po_receipt' });
      check5.evidence.recent_receipts_7d = movements.filter(m => m.performed_at >= sevenDaysAgo).length;

      if (check5.evidence.total_inbound > 0 && check5.evidence.recent_receipts_7d === 0) {
        report.warnings.push('Inbound stock exists but no PO receipts in last 7 days');
        report.summary.warnings++;
      }
    } catch (err) {
      check5.ok = false;
      check5.notes = `Error: ${err.message}`;
      report.failures.push(check5.notes);
      report.summary.failures++;
    }
    report.checks.push(check5);

    // ========================================
    // CHECK 6: Receiving Integrity
    // ========================================
    const check6 = { name: 'Receiving Integrity', ok: true, notes: '', evidence: { bad_receipts: [], qty_received_over_ordered: [] } };
    try {
      const movements = await base44.asServiceRole.entities.StockMovement.filter({ source: 'po_receipt' });
      const poLines = await base44.asServiceRole.entities.PurchaseOrderLine.list();

      for (const move of movements) {
        if (!move.price_list_item_id) {
          check6.evidence.bad_receipts.push(move.id);
          report.failures.push(`StockMovement ${move.id} (po_receipt): missing price_list_item_id`);
          report.summary.failures++;
          check6.ok = false;
        }
      }

      for (const line of poLines) {
        if ((line.qty_received || 0) > (line.qty_ordered || 0)) {
          check6.evidence.qty_received_over_ordered.push({ po_line_id: line.id, received: line.qty_received, ordered: line.qty_ordered });
          report.failures.push(`PurchaseOrderLine ${line.id}: qty_received (${line.qty_received}) > qty_ordered (${line.qty_ordered})`);
          report.summary.failures++;
          check6.ok = false;
        }
      }
    } catch (err) {
      check6.ok = false;
      check6.notes = `Error: ${err.message}`;
      report.failures.push(check6.notes);
      report.summary.failures++;
    }
    report.checks.push(check6);

    // ========================================
    // CHECK 7: Transfer Integrity
    // ========================================
    const check7 = { name: 'Transfer Integrity', ok: true, notes: '', evidence: { bad_transfers: [], negative_quantities: [] } };
    try {
      const movements = await base44.asServiceRole.entities.StockMovement.filter({ source: 'transfer' });
      const quantities = await base44.asServiceRole.entities.InventoryQuantity.list();

      for (const move of movements) {
        if (!move.from_location_id && !move.to_location_id) {
          check7.evidence.bad_transfers.push(move.id);
          report.warnings.push(`StockMovement ${move.id} (transfer): missing both from and to locations`);
          report.summary.warnings++;
        }
      }

      for (const qty of quantities) {
        if ((qty.quantity || 0) < 0) {
          check7.evidence.negative_quantities.push({ id: qty.id, quantity: qty.quantity, item: qty.item_name });
          report.failures.push(`InventoryQuantity ${qty.id}: negative quantity (${qty.quantity})`);
          report.summary.failures++;
          check7.ok = false;
        }
      }
    } catch (err) {
      check7.ok = false;
      check7.notes = `Error: ${err.message}`;
      report.failures.push(check7.notes);
      report.summary.failures++;
    }
    report.checks.push(check7);

    // ========================================
    // CHECK 8: Technician Constraints
    // ========================================
    const check8 = { name: 'Technician Constraints', ok: true, notes: '', evidence: { total_technicians: 0, properly_mapped: 0, unmapped_techs: [], multi_vehicle_techs: [] } };
    try {
      // Try to fetch technicians (users with extended_role='technician')
      const users = await base44.asServiceRole.entities.User.list();
      const technicians = users.filter(u => u.extended_role === 'technician' || u.is_field_technician).slice(0, 10);
      const vehicles = await base44.asServiceRole.entities.Vehicle.list();

      check8.evidence.total_technicians = technicians.length;

      for (const tech of technicians) {
        const assigned = vehicles.filter(v => v.assigned_user_id === tech.id);
        if (assigned.length === 0) {
          check8.evidence.unmapped_techs.push(tech.id);
          report.warnings.push(`Technician ${tech.id} (${tech.full_name || tech.email}) has no assigned vehicle`);
          report.summary.warnings++;
        } else if (assigned.length > 1) {
          check8.evidence.multi_vehicle_techs.push(tech.id);
          report.warnings.push(`Technician ${tech.id} has ${assigned.length} assigned vehicles (expected 1)`);
          report.summary.warnings++;
        } else {
          check8.evidence.properly_mapped++;
        }
      }

      if (check8.evidence.unmapped_techs.length > 0 || check8.evidence.multi_vehicle_techs.length > 0) {
        check8.ok = false;
      }
    } catch (err) {
      check8.notes = `Info: User entity not queryable or no technicians found`;
      // Not a critical failure, just informational
    }
    report.checks.push(check8);

    // ========================================
    // CHECK 9: Legacy Detector
    // ========================================
    const check9 = { name: 'Legacy Entity Detector', ok: true, notes: '', evidence: { VehicleStock: 0, PriceListItem_stock_level: 0, InventoryMovement: 0 } };
    try {
      // Check for VehicleStock entity (deprecated model)
      try {
        const vehicleStock = await base44.asServiceRole.entities.VehicleStock.list();
        check9.evidence.VehicleStock = vehicleStock.length;
        if (vehicleStock.length > 0) {
          report.warnings.push(`Legacy: VehicleStock entity still has ${vehicleStock.length} rows (deprecated; use InventoryLocation + InventoryQuantity)`);
          report.summary.warnings++;
        }
      } catch {
        check9.evidence.VehicleStock = 0; // Entity doesn't exist
      }

      // Check PriceListItem.stock_level usage
      const items = await base44.asServiceRole.entities.PriceListItem.list();
      const itemsWithStockLevel = items.filter(i => i.stock_level && i.stock_level > 0).length;
      check9.evidence.PriceListItem_stock_level = itemsWithStockLevel;
      if (itemsWithStockLevel > 0) {
        report.warnings.push(`Legacy: ${itemsWithStockLevel} PriceListItem(s) have stock_level set (deprecated; use InventoryQuantity)`);
        report.summary.warnings++;
      }

      // Check for InventoryMovement entity (deprecated)
      try {
        const movements = await base44.asServiceRole.entities.InventoryMovement.list();
        check9.evidence.InventoryMovement = movements.length;
        if (movements.length > 0) {
          report.warnings.push(`Legacy: InventoryMovement entity still has ${movements.length} rows (deprecated; use StockMovement)`);
          report.summary.warnings++;
        }
      } catch {
        check9.evidence.InventoryMovement = 0; // Entity doesn't exist
      }
    } catch (err) {
      check9.notes = `Info: Could not fully scan legacy entities: ${err.message}`;
    }
    report.checks.push(check9);

    // ========================================
    // Finalize Report
    // ========================================
    report.summary.pass = report.summary.failures === 0;

    return Response.json(report);
  } catch (error) {
    console.error('inventoryFlowCheckpoint error:', error);
    return Response.json({ error: error.message, success: false }, { status: 500 });
  }
});