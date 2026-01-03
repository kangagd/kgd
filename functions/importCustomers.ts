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

    const { action, file_url, column_mapping, records_to_import, check_duplicates_only } = await req.json();

    if (action === 'parse_csv') {
      // Parse CSV and return preview
      const response = await fetch(file_url);
      const csvText = await response.text();
      
      // Simple CSV parser (handles quoted values)
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

    if (action === 'check_duplicates') {
      // Check for duplicates
      const duplicateChecks = await Promise.all(
        records_to_import.map(async (record) => {
          const response = await base44.asServiceRole.functions.invoke('checkDuplicates', {
            entity_type: 'Customer',
            record: record,
            auto_update: false
          });
          
          return {
            record,
            has_duplicates: response.data?.has_duplicates || false,
            matches: response.data?.matches || []
          };
        })
      );

      return Response.json({
        success: true,
        duplicate_checks: duplicateChecks
      });
    }

    if (action === 'import') {
      // Import customers with validation
      const results = {
        created: 0,
        skipped: 0,
        errors: []
      };

      for (const record of records_to_import) {
        try {
          // Validation: Skip if name is blank/whitespace
          const trimmedName = (record.name || '').trim();
          if (!trimmedName) {
            results.skipped++;
            results.errors.push({
              record: 'Row with blank name',
              error: 'Skipped - name is required'
            });
            continue;
          }

          // Validation: Reject "Unknown" as customer name
          if (trimmedName.toLowerCase() === 'unknown') {
            results.skipped++;
            results.errors.push({
              record: trimmedName,
              error: 'Skipped - "Unknown" is not allowed as customer name'
            });
            continue;
          }

          const newCustomer = await base44.asServiceRole.entities.Customer.create(record);
          
          // Run duplicate check
          await base44.asServiceRole.functions.invoke('checkDuplicates', {
            entity_type: 'Customer',
            record: newCustomer,
            exclude_id: newCustomer.id,
            auto_update: true
          });

          results.created++;
        } catch (error) {
          results.errors.push({
            record: record.name || 'Unknown',
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