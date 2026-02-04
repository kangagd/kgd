import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function parseBool(val: any, defaultValue = true): boolean {
  if (val === true || val === false) return val;
  if (typeof val === 'string') {
    const v = val.trim().toLowerCase();
    if (v === 'true') return true;
    if (v === 'false') return false;
  }
  if (typeof val === 'number') return val !== 0;
  return defaultValue;
}

interface LocationReference {
  entity: string;
  count: number;
  examples: string[];
}

interface LocationReport {
  location_id: string;
  was_inactive: boolean;
  is_now_active: boolean;
  had_missing_code: boolean;
  had_missing_type: boolean;
  references: LocationReference[];
}

interface RepairReport {
  locations_scanned: number;
  locations_reactivated: number;
  locations_patched_metadata: number;
  locations_errors: number;
  details: LocationReport[];
  dry_run: boolean;
  summary: string;
}

async function getInactiveLocationsInUse(base44: any): Promise<string[]> {
  // Fetch all locations and check for references
  const allLocations = await base44.asServiceRole.entities.InventoryLocation.list();
  const inactiveIds = new Set<string>();

  for (const loc of allLocations) {
    if (!loc.is_active) {
      // Check if referenced in any entity
      const hasRef = await hasLocationReferences(base44, loc.id);
      if (hasRef) {
        inactiveIds.add(loc.id);
      }
    }
  }

  return Array.from(inactiveIds);
}

async function hasLocationReferences(base44: any, locationId: string): Promise<boolean> {
  try {
    // Check StockMovement
    const movements = await base44.asServiceRole.entities.StockMovement.filter({
      $or: [
        { from_location_id: locationId },
        { to_location_id: locationId }
      ]
    });
    if (movements.length > 0) return true;

    // Check StockAllocation
    const allocations = await base44.asServiceRole.entities.StockAllocation.filter({
      from_location_id: locationId
    });
    if (allocations.length > 0) return true;

    // Check ReceiptLine (via Receipt)
    const receipts = await base44.asServiceRole.entities.Receipt.filter({
      location_id: locationId
    });
    if (receipts.length > 0) return true;

    // Check LogisticsStop
    const stops = await base44.asServiceRole.entities.LogisticsStop.filter({
      $or: [
        { location_id: locationId },
        { target_location_id: locationId }
      ]
    });
    if (stops.length > 0) return true;

    // Check Job (source/destination location)
    const jobs = await base44.asServiceRole.entities.Job.filter({
      $or: [
        { source_location_id: locationId },
        { destination_location_id: locationId }
      ]
    });
    if (jobs.length > 0) return true;

    return false;
  } catch (error) {
    console.error(`Error checking references for location ${locationId}:`, error);
    return false;
  }
}

async function getLocationReferences(base44: any, locationId: string): Promise<LocationReference[]> {
  const refs: LocationReference[] = [];

  try {
    const movements = await base44.asServiceRole.entities.StockMovement.filter({
      $or: [
        { from_location_id: locationId },
        { to_location_id: locationId }
      ]
    });
    if (movements.length > 0) {
      refs.push({
        entity: 'StockMovement',
        count: movements.length,
        examples: movements.slice(0, 3).map((m: any) => m.id)
      });
    }

    const allocations = await base44.asServiceRole.entities.StockAllocation.filter({
      from_location_id: locationId
    });
    if (allocations.length > 0) {
      refs.push({
        entity: 'StockAllocation',
        count: allocations.length,
        examples: allocations.slice(0, 3).map((a: any) => a.id)
      });
    }

    const receipts = await base44.asServiceRole.entities.Receipt.filter({
      location_id: locationId
    });
    if (receipts.length > 0) {
      refs.push({
        entity: 'Receipt',
        count: receipts.length,
        examples: receipts.slice(0, 3).map((r: any) => r.id)
      });
    }

    const stops = await base44.asServiceRole.entities.LogisticsStop.filter({
      $or: [
        { location_id: locationId },
        { target_location_id: locationId }
      ]
    });
    if (stops.length > 0) {
      refs.push({
        entity: 'LogisticsStop',
        count: stops.length,
        examples: stops.slice(0, 3).map((s: any) => s.id)
      });
    }

    const jobs = await base44.asServiceRole.entities.Job.filter({
      $or: [
        { source_location_id: locationId },
        { destination_location_id: locationId }
      ]
    });
    if (jobs.length > 0) {
      refs.push({
        entity: 'Job',
        count: jobs.length,
        examples: jobs.slice(0, 3).map((j: any) => j.id)
      });
    }
  } catch (error) {
    console.error(`Error fetching references for location ${locationId}:`, error);
  }

  return refs;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const input = await req.json().catch(() => ({}));
    const dryRun = parseBool(input.dry_run, true);

    const inactiveLocationsInUse = await getInactiveLocationsInUse(base44);
    const report: RepairReport = {
      locations_scanned: inactiveLocationsInUse.length,
      locations_reactivated: 0,
      locations_patched_metadata: 0,
      locations_errors: 0,
      details: [],
      dry_run,
      summary: ''
    };

    for (const locationId of inactiveLocationsInUse) {
      try {
        const location = await base44.asServiceRole.entities.InventoryLocation.get(locationId);

        if (!location) {
          report.locations_errors++;
          continue;
        }

        const locationReport: LocationReport = {
          location_id: locationId,
          was_inactive: !location.is_active,
          is_now_active: location.is_active,
          had_missing_code: !location.location_code,
          had_missing_type: !location.location_type,
          references: await getLocationReferences(base44, locationId)
        };

        const updates: any = {};

        // Reactivate if inactive and has references
        if (!location.is_active && locationReport.references.length > 0) {
          updates.is_active = true;
          locationReport.is_now_active = true;
          report.locations_reactivated++;
        }

        // Fix metadata
        if (!location.location_code) {
          const shortId = locationId.substring(locationId.length - 6);
          updates.location_code = `LEGACY_${shortId}`;
        }

        if (!location.location_type) {
          updates.location_type = 'virtual';
        }

        updates.description = 'Legacy location reactivated to preserve referential integrity (auto-repair).';

        if (Object.keys(updates).length > 0) {
          if (!dry_run) {
            await base44.asServiceRole.entities.InventoryLocation.update(locationId, updates);
          }
          report.locations_patched_metadata++;
        }

        report.details.push(locationReport);
      } catch (error) {
        console.error(`Error processing location ${locationId}:`, error);
        report.locations_errors++;
      }
    }

    report.summary = `Scanned ${report.locations_scanned} inactive locations in use. Reactivated: ${report.locations_reactivated}, Patched metadata: ${report.locations_patched_metadata}, Errors: ${report.locations_errors}. ${dry_run ? '[DRY RUN - no changes made]' : '[CHANGES APPLIED]'}`;

    return Response.json(report);
  } catch (error) {
    console.error('Error in repairInactiveLocationsInUse:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});