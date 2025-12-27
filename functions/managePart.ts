import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { updateProjectActivity } from './updateProjectActivity.js';

// Canonical Part status values
const PART_STATUS = {
  PENDING: "pending",
  ON_ORDER: "on_order",
  IN_TRANSIT: "in_transit",
  IN_LOADING_BAY: "in_loading_bay",
  IN_STORAGE: "in_storage",
  IN_VEHICLE: "in_vehicle",
  INSTALLED: "installed",
  CANCELLED: "cancelled",
};

const PART_LOCATION = {
  SUPPLIER: "supplier",
  LOADING_BAY: "loading_bay",
  WAREHOUSE_STORAGE: "warehouse_storage",
  VEHICLE: "vehicle",
  CLIENT_SITE: "client_site",
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const { action } = payload;

    // ========================================
    // ACTION: create (basic Part creation)
    // ========================================
    if (action === 'create') {
      const { data } = payload;

      if (!data) {
        return Response.json({ error: 'data is required' }, { status: 400 });
      }

      const part = await base44.asServiceRole.entities.Part.create(data);
      
      console.log('[managePart:create] Created Part:', { 
        id: part.id, 
        project_id: part.project_id,
        status: part.status 
      });

      if (part.project_id) {
        await updateProjectActivity(base44, part.project_id, 'Part Created');
      }

      return Response.json({ success: true, part });
    }

    // ========================================
    // ACTION: update (generic update)
    // ========================================
    if (action === 'update') {
      const { id, data } = payload;

      if (!id || !data) {
        return Response.json({ error: 'id and data are required' }, { status: 400 });
      }

      const part = await base44.asServiceRole.entities.Part.update(id, data);

      console.log('[managePart:update] Updated Part:', { 
        id, 
        fields: Object.keys(data) 
      });

      if (part.project_id) {
        await updateProjectActivity(base44, part.project_id, 'Part Updated');
      }

      return Response.json({ success: true, part });
    }

    // ========================================
    // ACTION: delete
    // ========================================
    if (action === 'delete') {
      const { id } = payload;

      if (!id) {
        return Response.json({ error: 'id is required' }, { status: 400 });
      }

      await base44.asServiceRole.entities.Part.delete(id);

      console.log('[managePart:delete] Deleted Part:', { id });

      return Response.json({ success: true });
    }

    // ========================================
    // ACTION: assignToPurchaseOrder
    // ========================================
    if (action === 'assignToPurchaseOrder') {
      const { part_id, purchase_order_id, po_reference } = payload;

      if (!part_id || !purchase_order_id) {
        return Response.json({ 
          error: 'part_id and purchase_order_id are required' 
        }, { status: 400 });
      }

      // Forbidden fields check
      const forbiddenFields = ['status', 'location', 'supplier_id'];
      const passedForbidden = forbiddenFields.filter(f => payload[f] !== undefined);
      if (passedForbidden.length > 0) {
        console.error('❌ [assignToPurchaseOrder] Forbidden fields passed:', passedForbidden);
        return Response.json({ 
          error: `Forbidden fields: ${passedForbidden.join(', ')}. Use assignToPurchaseOrder only to link part to PO.` 
        }, { status: 400 });
      }

      const part = await base44.asServiceRole.entities.Part.get(part_id);
      if (!part) {
        return Response.json({ error: 'Part not found' }, { status: 404 });
      }

      const updateData = {
        purchase_order_id,
        po_number: po_reference || null,
        order_reference: po_reference || null,
      };

      const updatedPart = await base44.asServiceRole.entities.Part.update(part_id, updateData);

      console.log('[assignToPurchaseOrder] Assigned Part to PO:', { 
        part_id, 
        purchase_order_id,
        po_reference 
      });

      if (updatedPart.project_id) {
        await updateProjectActivity(base44, updatedPart.project_id, 'Part Assigned to PO');
      }

      return Response.json({ success: true, part: updatedPart });
    }

    // ========================================
    // ACTION: markOrdered
    // ========================================
    if (action === 'markOrdered') {
      const { part_id, order_date, supplier_id } = payload;

      if (!part_id) {
        return Response.json({ error: 'part_id is required' }, { status: 400 });
      }

      // Forbidden fields check
      const forbiddenFields = ['location', 'purchase_order_id'];
      const passedForbidden = forbiddenFields.filter(f => payload[f] !== undefined);
      if (passedForbidden.length > 0) {
        console.error('❌ [markOrdered] Forbidden fields passed:', passedForbidden);
        return Response.json({ 
          error: `Forbidden fields: ${passedForbidden.join(', ')}. Use markOrdered only to update status and order metadata.` 
        }, { status: 400 });
      }

      const part = await base44.asServiceRole.entities.Part.get(part_id);
      if (!part) {
        return Response.json({ error: 'Part not found' }, { status: 404 });
      }

      const updateData = {
        status: PART_STATUS.ON_ORDER,
        location: PART_LOCATION.SUPPLIER,
        order_date: order_date || new Date().toISOString().split('T')[0],
      };

      if (supplier_id !== undefined) {
        updateData.supplier_id = supplier_id;
        // Fetch supplier name
        if (supplier_id) {
          try {
            const supplier = await base44.asServiceRole.entities.Supplier.get(supplier_id);
            updateData.supplier_name = supplier?.name || null;
          } catch (err) {
            console.error('Failed to fetch supplier:', err);
          }
        }
      }

      const updatedPart = await base44.asServiceRole.entities.Part.update(part_id, updateData);

      console.log('[markOrdered] Marked Part as ordered:', { 
        part_id, 
        status: PART_STATUS.ON_ORDER 
      });

      if (updatedPart.project_id) {
        await updateProjectActivity(base44, updatedPart.project_id, 'Part Ordered');
      }

      return Response.json({ success: true, part: updatedPart });
    }

    // ========================================
    // ACTION: markReceived
    // ========================================
    if (action === 'markReceived') {
      const { part_id, received_date } = payload;

      if (!part_id) {
        return Response.json({ error: 'part_id is required' }, { status: 400 });
      }

      // Forbidden fields check
      const forbiddenFields = ['supplier_id', 'purchase_order_id'];
      const passedForbidden = forbiddenFields.filter(f => payload[f] !== undefined);
      if (passedForbidden.length > 0) {
        console.error('❌ [markReceived] Forbidden fields passed:', passedForbidden);
        return Response.json({ 
          error: `Forbidden fields: ${passedForbidden.join(', ')}. Use markReceived only to update status and location.` 
        }, { status: 400 });
      }

      const part = await base44.asServiceRole.entities.Part.get(part_id);
      if (!part) {
        return Response.json({ error: 'Part not found' }, { status: 404 });
      }

      const updateData = {
        status: PART_STATUS.IN_LOADING_BAY,
        location: PART_LOCATION.LOADING_BAY,
        received_date: received_date || new Date().toISOString().split('T')[0],
      };

      const updatedPart = await base44.asServiceRole.entities.Part.update(part_id, updateData);

      console.log('[markReceived] Marked Part as received:', { 
        part_id, 
        status: PART_STATUS.IN_LOADING_BAY,
        location: PART_LOCATION.LOADING_BAY
      });

      if (updatedPart.project_id) {
        await updateProjectActivity(base44, updatedPart.project_id, 'Part Received');
      }

      return Response.json({ success: true, part: updatedPart });
    }

    // ========================================
    // ACTION: moveToStorage
    // ========================================
    if (action === 'moveToStorage') {
      const { part_id } = payload;

      if (!part_id) {
        return Response.json({ error: 'part_id is required' }, { status: 400 });
      }

      // Forbidden fields check
      const forbiddenFields = ['supplier_id', 'purchase_order_id', 'order_date'];
      const passedForbidden = forbiddenFields.filter(f => payload[f] !== undefined);
      if (passedForbidden.length > 0) {
        console.error('❌ [moveToStorage] Forbidden fields passed:', passedForbidden);
        return Response.json({ 
          error: `Forbidden fields: ${passedForbidden.join(', ')}. Use moveToStorage only to update status and location.` 
        }, { status: 400 });
      }

      const part = await base44.asServiceRole.entities.Part.get(part_id);
      if (!part) {
        return Response.json({ error: 'Part not found' }, { status: 404 });
      }

      const updateData = {
        status: PART_STATUS.IN_STORAGE,
        location: PART_LOCATION.WAREHOUSE_STORAGE,
      };

      const updatedPart = await base44.asServiceRole.entities.Part.update(part_id, updateData);

      console.log('[moveToStorage] Moved Part to storage:', { 
        part_id, 
        status: PART_STATUS.IN_STORAGE,
        location: PART_LOCATION.WAREHOUSE_STORAGE
      });

      if (updatedPart.project_id) {
        await updateProjectActivity(base44, updatedPart.project_id, 'Part Moved to Storage');
      }

      return Response.json({ success: true, part: updatedPart });
    }

    // ========================================
    // ACTION: assignToVehicle
    // ========================================
    if (action === 'assignToVehicle') {
      const { part_id, vehicle_id } = payload;

      if (!part_id || !vehicle_id) {
        return Response.json({ 
          error: 'part_id and vehicle_id are required' 
        }, { status: 400 });
      }

      // Forbidden fields check
      const forbiddenFields = ['supplier_id', 'purchase_order_id', 'order_date'];
      const passedForbidden = forbiddenFields.filter(f => payload[f] !== undefined);
      if (passedForbidden.length > 0) {
        console.error('❌ [assignToVehicle] Forbidden fields passed:', passedForbidden);
        return Response.json({ 
          error: `Forbidden fields: ${passedForbidden.join(', ')}. Use assignToVehicle only to update status, location, and vehicle.` 
        }, { status: 400 });
      }

      const part = await base44.asServiceRole.entities.Part.get(part_id);
      if (!part) {
        return Response.json({ error: 'Part not found' }, { status: 404 });
      }

      const updateData = {
        status: PART_STATUS.IN_VEHICLE,
        location: PART_LOCATION.VEHICLE,
        assigned_vehicle_id: vehicle_id,
        vehicle_id: vehicle_id,
      };

      const updatedPart = await base44.asServiceRole.entities.Part.update(part_id, updateData);

      console.log('[assignToVehicle] Assigned Part to vehicle:', { 
        part_id, 
        vehicle_id,
        status: PART_STATUS.IN_VEHICLE,
        location: PART_LOCATION.VEHICLE
      });

      if (updatedPart.project_id) {
        await updateProjectActivity(base44, updatedPart.project_id, 'Part Assigned to Vehicle');
      }

      return Response.json({ success: true, part: updatedPart });
    }

    // ========================================
    // ACTION: markInstalled
    // ========================================
    if (action === 'markInstalled') {
      const { part_id, installed_date, job_id } = payload;

      if (!part_id) {
        return Response.json({ error: 'part_id is required' }, { status: 400 });
      }

      // Forbidden fields check
      const forbiddenFields = ['supplier_id', 'purchase_order_id', 'vehicle_id'];
      const passedForbidden = forbiddenFields.filter(f => payload[f] !== undefined);
      if (passedForbidden.length > 0) {
        console.error('❌ [markInstalled] Forbidden fields passed:', passedForbidden);
        return Response.json({ 
          error: `Forbidden fields: ${passedForbidden.join(', ')}. Use markInstalled only to update status and location.` 
        }, { status: 400 });
      }

      const part = await base44.asServiceRole.entities.Part.get(part_id);
      if (!part) {
        return Response.json({ error: 'Part not found' }, { status: 404 });
      }

      const updateData = {
        status: PART_STATUS.INSTALLED,
        location: PART_LOCATION.CLIENT_SITE,
      };

      if (installed_date !== undefined) {
        updateData.installed_date = installed_date || new Date().toISOString().split('T')[0];
      }

      if (job_id !== undefined) {
        updateData.installed_job_id = job_id;
      }

      const updatedPart = await base44.asServiceRole.entities.Part.update(part_id, updateData);

      console.log('[markInstalled] Marked Part as installed:', { 
        part_id, 
        status: PART_STATUS.INSTALLED,
        location: PART_LOCATION.CLIENT_SITE
      });

      if (updatedPart.project_id) {
        await updateProjectActivity(base44, updatedPart.project_id, 'Part Installed');
      }

      return Response.json({ success: true, part: updatedPart });
    }

    // ========================================
    // ACTION: bulkUpdateStatus (for batch operations)
    // ========================================
    if (action === 'bulkUpdateStatus') {
      const { part_ids, status, location } = payload;

      if (!part_ids || !Array.isArray(part_ids) || part_ids.length === 0) {
        return Response.json({ error: 'part_ids array is required' }, { status: 400 });
      }

      if (!status) {
        return Response.json({ error: 'status is required' }, { status: 400 });
      }

      const updatedParts = [];

      for (const part_id of part_ids) {
        try {
          const part = await base44.asServiceRole.entities.Part.get(part_id);
          if (!part) continue;

          const updateData = { status };
          if (location !== undefined) {
            updateData.location = location;
          }

          const updated = await base44.asServiceRole.entities.Part.update(part_id, updateData);
          updatedParts.push(updated);

          if (updated.project_id) {
            await updateProjectActivity(base44, updated.project_id, 'Parts Updated');
          }
        } catch (err) {
          console.error(`Failed to update part ${part_id}:`, err);
        }
      }

      console.log('[bulkUpdateStatus] Updated parts:', { 
        count: updatedParts.length,
        status,
        location 
      });

      return Response.json({ success: true, parts: updatedParts });
    }

    // ========================================
    // ACTION: updateMetadata (for notes, attachments, etc.)
    // ========================================
    if (action === 'updateMetadata') {
      const { part_id, notes, attachments, eta, tracking_url } = payload;

      if (!part_id) {
        return Response.json({ error: 'part_id is required' }, { status: 400 });
      }

      // Forbidden fields check
      const forbiddenFields = ['status', 'location', 'supplier_id', 'purchase_order_id', 'vehicle_id'];
      const passedForbidden = forbiddenFields.filter(f => payload[f] !== undefined);
      if (passedForbidden.length > 0) {
        console.error('❌ [updateMetadata] Forbidden fields passed:', passedForbidden);
        return Response.json({ 
          error: `Forbidden fields: ${passedForbidden.join(', ')}. Use updateMetadata only for notes, attachments, eta, tracking_url.` 
        }, { status: 400 });
      }

      const part = await base44.asServiceRole.entities.Part.get(part_id);
      if (!part) {
        return Response.json({ error: 'Part not found' }, { status: 404 });
      }

      const updateData = {};
      if (notes !== undefined) updateData.notes = notes;
      if (attachments !== undefined) updateData.attachments = attachments;
      if (eta !== undefined) updateData.eta = eta;
      if (tracking_url !== undefined) updateData.tracking_url = tracking_url;

      const updatedPart = await base44.asServiceRole.entities.Part.update(part_id, updateData);

      console.log('[updateMetadata] Updated Part metadata:', { 
        part_id, 
        fields: Object.keys(updateData) 
      });

      return Response.json({ success: true, part: updatedPart });
    }

    return Response.json({ 
      error: 'Invalid action. Supported: create, update, delete, assignToPurchaseOrder, markOrdered, markReceived, moveToStorage, assignToVehicle, markInstalled, bulkUpdateStatus, updateMetadata' 
    }, { status: 400 });

  } catch (error) {
    console.error('[managePart] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});