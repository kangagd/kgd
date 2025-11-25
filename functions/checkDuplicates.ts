import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Normalization helpers
function normalizeString(str) {
  if (!str) return '';
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

function normalizePhone(phone) {
  if (!phone) return '';
  return phone.replace(/[\s\+\(\)\-\.]/g, '');
}

function normalizeAddress(record) {
  const parts = [
    record.address_street,
    record.address_suburb,
    record.address_state,
    record.address_postcode,
    record.address_full,
    record.address
  ].filter(Boolean);
  
  return normalizeString(parts.join(' '));
}

// Check duplicates for Customer
async function checkCustomerDuplicates(base44, record, excludeId) {
  const matches = [];
  let score = 0;
  
  const normalizedName = normalizeString(record.name);
  const normalizedEmail = record.email ? record.email.toLowerCase().trim() : '';
  const normalizedPhone = normalizePhone(record.phone);
  const normalizedAddress = normalizeAddress(record);
  
  // Get all customers (excluding deleted and current record)
  const allCustomers = await base44.asServiceRole.entities.Customer.filter({
    deleted_at: { $exists: false }
  });
  
  const otherCustomers = allCustomers.filter(c => c.id !== excludeId);
  
  for (const other of otherCustomers) {
    const otherNormalizedName = normalizeString(other.name);
    const otherNormalizedEmail = other.email ? other.email.toLowerCase().trim() : '';
    const otherNormalizedPhone = normalizePhone(other.phone);
    const otherNormalizedAddress = other.normalized_address || normalizeAddress(other);
    
    let matchScore = 0;
    const matchReasons = [];
    
    // Rule 1: Same normalized email
    if (normalizedEmail && otherNormalizedEmail && normalizedEmail === otherNormalizedEmail) {
      matchScore++;
      matchReasons.push('email');
    }
    
    // Rule 2: Same normalized phone
    if (normalizedPhone && otherNormalizedPhone && normalizedPhone === otherNormalizedPhone) {
      matchScore++;
      matchReasons.push('phone');
    }
    
    // Rule 3: Same name AND same address
    if (normalizedName && otherNormalizedName && normalizedName === otherNormalizedName &&
        normalizedAddress && otherNormalizedAddress && normalizedAddress === otherNormalizedAddress) {
      matchScore++;
      matchReasons.push('name+address');
    }
    
    if (matchScore > 0) {
      matches.push({
        id: other.id,
        name: other.name,
        email: other.email,
        phone: other.phone,
        address_full: other.address_full,
        match_score: matchScore,
        match_reasons: matchReasons
      });
      score = Math.max(score, matchScore);
    }
  }
  
  return {
    normalized_name: normalizedName,
    normalized_email: normalizedEmail || null,
    normalized_phone: normalizedPhone || null,
    normalized_address: normalizedAddress || null,
    is_potential_duplicate: matches.length > 0,
    duplicate_score: score,
    matches
  };
}

// Check duplicates for Project
async function checkProjectDuplicates(base44, record, excludeId) {
  const matches = [];
  let score = 0;
  
  const normalizedTitle = normalizeString(record.title);
  const normalizedAddress = normalizeAddress(record);
  const customerId = record.customer_id;
  
  // Get all projects (excluding deleted and current record)
  const allProjects = await base44.asServiceRole.entities.Project.filter({
    deleted_at: { $exists: false }
  });
  
  const otherProjects = allProjects.filter(p => p.id !== excludeId);
  
  for (const other of otherProjects) {
    const otherNormalizedTitle = normalizeString(other.title);
    const otherNormalizedAddress = other.normalized_address || normalizeAddress(other);
    
    let matchScore = 0;
    const matchReasons = [];
    
    // Rule 1: Same customer_id AND same normalized_address
    if (customerId && other.customer_id === customerId &&
        normalizedAddress && otherNormalizedAddress && normalizedAddress === otherNormalizedAddress) {
      matchScore++;
      matchReasons.push('customer+address');
    }
    
    // Rule 2: Same normalized_title AND same customer_id
    if (normalizedTitle && otherNormalizedTitle && normalizedTitle === otherNormalizedTitle &&
        customerId && other.customer_id === customerId) {
      matchScore++;
      matchReasons.push('title+customer');
    }
    
    if (matchScore > 0) {
      matches.push({
        id: other.id,
        title: other.title,
        customer_id: other.customer_id,
        customer_name: other.customer_name,
        address_full: other.address_full,
        status: other.status,
        match_score: matchScore,
        match_reasons: matchReasons
      });
      score = Math.max(score, matchScore);
    }
  }
  
  return {
    normalized_title: normalizedTitle,
    normalized_address: normalizedAddress || null,
    is_potential_duplicate: matches.length > 0,
    duplicate_score: score,
    matches
  };
}

// Check duplicates for Job
async function checkJobDuplicates(base44, record, excludeId) {
  const matches = [];
  let score = 0;
  
  const normalizedAddress = normalizeAddress(record);
  const customerId = record.customer_id;
  const projectId = record.project_id;
  const scheduledDate = record.scheduled_date;
  const jobType = record.job_type_name || record.job_type;
  
  // Get all jobs (excluding deleted and current record)
  const allJobs = await base44.asServiceRole.entities.Job.filter({
    deleted_at: { $exists: false }
  });
  
  const otherJobs = allJobs.filter(j => j.id !== excludeId);
  
  for (const other of otherJobs) {
    const otherNormalizedAddress = other.normalized_address || normalizeAddress(other);
    const otherJobType = other.job_type_name || other.job_type;
    
    let matchScore = 0;
    const matchReasons = [];
    
    // Rule 1: Same customer_id AND same scheduled_date AND same normalized_address
    if (customerId && other.customer_id === customerId &&
        scheduledDate && other.scheduled_date === scheduledDate &&
        normalizedAddress && otherNormalizedAddress && normalizedAddress === otherNormalizedAddress) {
      matchScore++;
      matchReasons.push('customer+date+address');
    }
    
    // Rule 2: Same project_id AND same job_type AND same scheduled_date
    if (projectId && other.project_id === projectId &&
        jobType && otherJobType && jobType === otherJobType &&
        scheduledDate && other.scheduled_date === scheduledDate) {
      matchScore++;
      matchReasons.push('project+type+date');
    }
    
    if (matchScore > 0) {
      matches.push({
        id: other.id,
        job_number: other.job_number,
        customer_id: other.customer_id,
        customer_name: other.customer_name,
        project_id: other.project_id,
        project_name: other.project_name,
        scheduled_date: other.scheduled_date,
        job_type_name: otherJobType,
        address_full: other.address_full,
        status: other.status,
        match_score: matchScore,
        match_reasons: matchReasons
      });
      score = Math.max(score, matchScore);
    }
  }
  
  return {
    normalized_address: normalizedAddress || null,
    is_potential_duplicate: matches.length > 0,
    duplicate_score: score,
    matches
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entity_type, record, exclude_id, auto_update } = await req.json();

    if (!entity_type || !record) {
      return Response.json({ error: 'entity_type and record are required' }, { status: 400 });
    }

    let result;

    switch (entity_type) {
      case 'Customer':
        result = await checkCustomerDuplicates(base44, record, exclude_id);
        break;
      case 'Project':
        result = await checkProjectDuplicates(base44, record, exclude_id);
        break;
      case 'Job':
        result = await checkJobDuplicates(base44, record, exclude_id);
        break;
      default:
        return Response.json({ error: `Unknown entity type: ${entity_type}` }, { status: 400 });
    }

    // If auto_update is true and we have an exclude_id, update the record with duplicate flags
    if (auto_update && exclude_id) {
      const updateData = {
        is_potential_duplicate: result.is_potential_duplicate,
        duplicate_score: result.duplicate_score
      };

      // Add normalized fields
      if (entity_type === 'Customer') {
        updateData.normalized_name = result.normalized_name;
        updateData.normalized_email = result.normalized_email;
        updateData.normalized_phone = result.normalized_phone;
        updateData.normalized_address = result.normalized_address;
      } else if (entity_type === 'Project') {
        updateData.normalized_title = result.normalized_title;
        updateData.normalized_address = result.normalized_address;
      } else if (entity_type === 'Job') {
        updateData.normalized_address = result.normalized_address;
      }

      await base44.asServiceRole.entities[entity_type].update(exclude_id, updateData);
    }

    return Response.json({
      entity_type,
      ...result
    });

  } catch (error) {
    console.error('Check duplicates error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});