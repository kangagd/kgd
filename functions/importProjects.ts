import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin' && user.role !== 'manager') {
      return Response.json({ error: 'Forbidden: Admin or Manager access required' }, { status: 403 });
    }

    const { action, file_url, records_to_import } = await req.json();

    if (action === 'parse_csv') {
      // Parse CSV and return preview
      const response = await fetch(file_url);
      const csvText = await response.text();
      
      const lines = csvText.split('\n').filter(line => line.trim());
      if (lines.length === 0) {
        return Response.json({ error: 'CSV file is empty' }, { status: 400 });
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const rows = lines.slice(1, 6).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const row = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });
        return row;
      });

      return Response.json({
        success: true,
        headers,
        preview_rows: rows,
        total_rows: lines.length - 1
      });
    }

    if (action === 'import') {
      const results = {
        created: 0,
        skipped: 0,
        errors: []
      };

      // Strict YYYY-MM-DD validation regex
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

      for (const record of records_to_import) {
        try {
          // Validation: Skip if title is blank
          const trimmedTitle = (record.title || '').trim();
          if (!trimmedTitle) {
            results.skipped++;
            results.errors.push({
              record: 'Row with blank title',
              error: 'Skipped - title is required'
            });
            continue;
          }

          // Validate date fields - must be YYYY-MM-DD format only
          const dateFields = ['opened_date', 'completed_date', 'lost_date'];
          for (const field of dateFields) {
            if (record[field]) {
              const dateValue = String(record[field]).trim();
              if (dateValue && !dateRegex.test(dateValue)) {
                results.skipped++;
                results.errors.push({
                  record: trimmedTitle,
                  error: `Invalid ${field} format: "${dateValue}". Must be YYYY-MM-DD (e.g., 2025-01-15)`
                });
                continue;
              }
            }
          }

          // Validate status field against allowed enum values
          const allowedStatuses = [
            'Lead', 'Initial Site Visit', 'Create Quote', 'Quote Sent', 
            'Quote Approved', 'Final Measure', 'Parts Ordered', 
            'Scheduled', 'Completed', 'Warranty', 'Lost'
          ];
          
          let statusValue = 'Lead';
          let statusNote = '';
          
          if (record.status) {
            const providedStatus = String(record.status).trim();
            if (allowedStatuses.includes(providedStatus)) {
              statusValue = providedStatus;
            } else {
              // Invalid status - default to Lead and append to notes
              statusNote = `\n[Import Note: Original status was "${providedStatus}"]`;
            }
          }

          // Resolve customer_id if present, otherwise populate import_customer_name_raw
          let customerData = {};
          if (record.customer_id) {
            try {
              const customer = await base44.asServiceRole.entities.Customer.get(record.customer_id);
              if (customer) {
                customerData.customer_id = customer.id;
                customerData.customer_name = customer.name;
                customerData.customer_phone = customer.phone;
                customerData.customer_email = customer.email;
              } else {
                // Customer ID provided but not found - store raw name
                customerData.import_customer_name_raw = record.customer_name || record.customer_id;
              }
            } catch (e) {
              // Customer ID provided but failed to resolve - store raw name
              customerData.import_customer_name_raw = record.customer_name || record.customer_id;
            }
          } else if (record.customer_name) {
            // No customer_id provided - store raw customer name
            customerData.import_customer_name_raw = record.customer_name;
          }

          // Resolve and cache organisation_name if organisation_id is present
          let organisationName = null;
          if (record.organisation_id) {
            try {
              const organisation = await base44.asServiceRole.entities.Organisation.get(record.organisation_id);
              if (organisation) {
                organisationName = organisation.name;
              }
            } catch (e) {
              console.error("Error resolving organisation name for import:", e);
            }
          }

          // Explicitly set duplicate detection flags to false/0 for imports
          // Preserve legacy fields verbatim without transformation
          const projectData = {
            ...record,
            ...customerData,
            status: statusValue,
            is_potential_duplicate: false,
            duplicate_score: 0,
            // Cache organisation_name for display
            organisation_name: organisationName,
            // Preserve legacy fields as-is
            pipedrive_deal_id: record.pipedrive_deal_id || null,
            legacy_xero_invoice_url: record.legacy_xero_invoice_url || null,
            legacy_pandadoc_url: record.legacy_pandadoc_url || null,
            // Notes field preserved verbatim (may contain legacy stage text) + status note if needed
            notes: (record.notes || '') + statusNote
          };

          // Create project without duplicate detection
          await base44.asServiceRole.entities.Project.create(projectData);

          results.created++;
        } catch (error) {
          results.errors.push({
            record: record.title || record.project_number || 'Unknown',
            error: error.message
          });
        }
      }

      return Response.json({
        success: true,
        results
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});