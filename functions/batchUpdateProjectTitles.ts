import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Batch update project titles to follow naming convention:
 * Product Type - (Builder/SP) - Address
 * e.g. "Roller Door Install - 21 Wallis Pde"
 */

// Helper to extract door type from title/description
const inferDoorType = (title, description) => {
  const text = `${title || ''} ${description || ''}`.toLowerCase();
  
  if (text.match(/\b(roller|roll)\b/)) return 'Roller Door';
  if (text.match(/\b(sectional|panel)\b/)) return 'Sectional Door';
  if (text.match(/\bcustom\b/)) return 'Custom Door';
  if (text.match(/\bgate\b/)) return 'Gate';
  if (text.match(/\bshutter\b/)) return 'Roller Shutter';
  
  return null;
};

// Helper to format address (number + street name only)
const formatShortAddress = (project) => {
  if (project.address_street) {
    const parts = project.address_street.split(',')[0].trim().split(' ');
    // Take first 2-3 parts (e.g., "21 Wallis Pde" or "123 Main St")
    return parts.slice(0, Math.min(3, parts.length)).join(' ');
  }
  
  if (project.address_full) {
    // Extract just the street portion
    const match = project.address_full.match(/^([\d\-\/]+\s+[^,]+)/);
    if (match) {
      return match[1].trim();
    }
  }
  
  return null;
};

// Generate new title following convention
const generateProjectTitle = (project, customer) => {
  const parts = [];
  
  // 1. Product Type
  let productType = null;
  
  if (project.project_type) {
    const doorType = inferDoorType(project.title, project.description);
    
    switch (project.project_type) {
      case 'Garage Door Install':
        productType = doorType ? `${doorType} Install` : 'Garage Door Install';
        break;
      case 'Gate Install':
        productType = 'Gate Install';
        break;
      case 'Roller Shutter Install':
        productType = 'Roller Shutter Install';
        break;
      case 'Repair':
        productType = doorType ? `${doorType} Repair` : 'Repair';
        break;
      case 'Motor/Accessory':
        productType = doorType ? `${doorType} Motor` : 'Motor Install';
        break;
      case 'Maintenance':
        productType = doorType ? `${doorType} Maintenance` : 'Maintenance';
        break;
      default:
        productType = project.project_type;
    }
  } else {
    // Try to infer from existing title
    const doorType = inferDoorType(project.title, project.description);
    if (doorType) {
      productType = doorType;
    }
  }
  
  if (productType) {
    parts.push(productType);
  }
  
  // 2. Builder/Strata identifier
  if (customer) {
    if (customer.customer_type === 'Builder' && project.organisation_name) {
      parts.push(project.organisation_name);
    } else if (customer.customer_type?.includes('Strata') && customer.sp_number) {
      parts.push(`SP${customer.sp_number}`);
    }
  }
  
  // 3. Address
  const shortAddress = formatShortAddress(project);
  if (shortAddress) {
    parts.push(shortAddress);
  }
  
  return parts.length > 0 ? parts.join(' - ') : null;
};

// Determine if title looks manually customized or generic
const shouldUpdate = (currentTitle, newTitle) => {
  if (!currentTitle || !newTitle) return false;
  if (currentTitle === newTitle) return false;
  
  const current = currentTitle.toLowerCase().trim();
  
  // Skip if very generic
  if (current.match(/^(project|untitled|new project|test)/i)) return true;
  
  // Skip if already follows convention closely
  if (current.includes(' - ') && current.split(' - ').length >= 2) {
    // Has convention structure, only update if significantly different
    return false;
  }
  
  // Update if title is just product type without details
  if (current.match(/^(garage door|gate|roller shutter|repair|maintenance|motor)$/i)) {
    return true;
  }
  
  return true;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { dryRun = true, limit = 100, minConfidence = 'medium' } = body;

    // Fetch projects and customers
    const projects = await base44.asServiceRole.entities.Project.filter({
      deleted_at: null
    });

    const customers = await base44.asServiceRole.entities.Customer.list();
    const customerMap = new Map(customers.map(c => [c.id, c]));

    const results = {
      total: Math.min(projects.length, limit),
      to_update: [],
      skipped: [],
      updated: 0,
      errors: []
    };

    for (let i = 0; i < Math.min(projects.length, limit); i++) {
      const project = projects[i];
      
      try {
        const customer = customerMap.get(project.customer_id);
        const newTitle = generateProjectTitle(project, customer);
        
        if (!newTitle) {
          results.skipped.push({
            project_id: project.id,
            project_number: project.project_number,
            current_title: project.title,
            reason: 'Could not generate new title - missing data'
          });
          continue;
        }

        // Determine confidence
        let confidence = 'low';
        if (project.project_type && project.address_street) {
          confidence = 'high';
        } else if (project.project_type || project.address_street) {
          confidence = 'medium';
        }

        // Check if should update
        if (!shouldUpdate(project.title, newTitle)) {
          results.skipped.push({
            project_id: project.id,
            project_number: project.project_number,
            current_title: project.title,
            generated_title: newTitle,
            reason: 'Title already follows convention or is customized'
          });
          continue;
        }

        // Skip if below confidence threshold
        const confidenceLevels = { low: 0, medium: 1, high: 2 };
        if (confidenceLevels[confidence] < confidenceLevels[minConfidence]) {
          results.skipped.push({
            project_id: project.id,
            project_number: project.project_number,
            current_title: project.title,
            generated_title: newTitle,
            confidence,
            reason: `Confidence ${confidence} below threshold ${minConfidence}`
          });
          continue;
        }

        const updateInfo = {
          project_id: project.id,
          project_number: project.project_number,
          current_title: project.title,
          new_title: newTitle,
          confidence,
          customer_type: customer?.customer_type || 'Unknown',
          has_project_type: !!project.project_type,
          has_address: !!(project.address_street || project.address_full)
        };

        results.to_update.push(updateInfo);

        // Perform update if not dry run
        if (!dryRun) {
          await base44.asServiceRole.entities.Project.update(project.id, {
            title: newTitle
          });
          results.updated++;
          
          // Small delay to avoid rate limits
          if (i % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

      } catch (error) {
        results.errors.push({
          project_id: project.id,
          project_number: project.project_number,
          error: error.message
        });
      }
    }

    return Response.json({
      success: true,
      dry_run: dryRun,
      summary: {
        total_processed: results.total,
        to_update: results.to_update.length,
        skipped: results.skipped.length,
        updated: results.updated,
        errors: results.errors.length
      },
      results
    });

  } catch (error) {
    console.error('batchUpdateProjectTitles error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});