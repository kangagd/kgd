/**
 * auditSampleIntegrity - Sample Data Integrity Auditor
 * 
 * Scans all Sample records for data integrity violations.
 * 
 * ⚠️ This function detects samples that violate business rules:
 * - Warehouse samples with reference IDs
 * - Checked out samples not in project location
 * - Retired samples with checkout data
 * 
 * Run periodically to detect any direct database updates that bypassed manageSample.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only admins can run audits
    if (!user || user.role !== 'admin') {
      return Response.json({ 
        success: false, 
        error: 'Unauthorized. Only admins can run integrity audits.' 
      }, { status: 403 });
    }

    console.log(`🔍 Sample Integrity Audit started by ${user.email} at ${new Date().toISOString()}`);

    // Fetch all samples
    const samples = await base44.asServiceRole.entities.Sample.list();
    
    const violations = [];

    for (const sample of samples) {
      const sampleViolations = [];

      // Rule 1: Warehouse samples must not have reference IDs
      if (sample.current_location_type === 'warehouse' && sample.current_location_reference_id !== null) {
        sampleViolations.push({
          rule: 'warehouse_reference_id',
          message: 'Warehouse samples must have null current_location_reference_id',
          current_value: sample.current_location_reference_id
        });
      }

      // Rule 2: Checked out samples must be in project location
      if (sample.checked_out_project_id) {
        if (sample.current_location_type !== 'project') {
          sampleViolations.push({
            rule: 'checkout_location_mismatch',
            message: 'Checked out samples must have current_location_type = project',
            current_location_type: sample.current_location_type,
            checked_out_project_id: sample.checked_out_project_id
          });
        }
        if (sample.current_location_reference_id !== sample.checked_out_project_id) {
          sampleViolations.push({
            rule: 'checkout_reference_mismatch',
            message: 'current_location_reference_id must equal checked_out_project_id',
            current_location_reference_id: sample.current_location_reference_id,
            checked_out_project_id: sample.checked_out_project_id
          });
        }
      }

      // Rule 3: Retired samples must not have checkout data
      if (sample.status === 'retired') {
        const hasCheckoutData = sample.checked_out_project_id || 
                               sample.checked_out_by_user_id || 
                               sample.checked_out_at || 
                               sample.due_back_at;
        if (hasCheckoutData) {
          sampleViolations.push({
            rule: 'retired_checkout_data',
            message: 'Retired samples must have all checkout fields null',
            checkout_fields: {
              checked_out_project_id: sample.checked_out_project_id,
              checked_out_by_user_id: sample.checked_out_by_user_id,
              checked_out_at: sample.checked_out_at,
              due_back_at: sample.due_back_at
            }
          });
        }
      }

      if (sampleViolations.length > 0) {
        violations.push({
          sample_id: sample.id,
          sample_name: sample.name,
          sample_tag: sample.sample_tag,
          violations: sampleViolations,
          last_updated: sample.updated_date,
          created_by: sample.created_by
        });

        console.error('⚠️ INTEGRITY VIOLATION DETECTED:', JSON.stringify({
          sample_id: sample.id,
          sample_name: sample.name,
          violations: sampleViolations
        }, null, 2));
      }
    }

    const auditResult = {
      success: true,
      timestamp: new Date().toISOString(),
      audited_by: user.email,
      total_samples: samples.length,
      violations_found: violations.length,
      violations: violations
    };

    if (violations.length > 0) {
      console.error(`❌ AUDIT COMPLETE: Found ${violations.length} samples with integrity violations`);
    } else {
      console.log('✅ AUDIT COMPLETE: All samples passed integrity checks');
    }

    return Response.json(auditResult);

  } catch (error) {
    console.error('Error in auditSampleIntegrity:', error);
    return Response.json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
});