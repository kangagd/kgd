import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Normalization helpers
function normalizeString(str) {
  if (!str) return '';
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

function normalizePhone(phone) {
  if (!phone) return '';
  const digitsOnly = phone.replace(/[\s\+\(\)\-\.]/g, '');
  if (/^4\d{8}$/.test(digitsOnly)) {
    return '+61' + digitsOnly;
  }
  if (/^61\d{9}$/.test(digitsOnly)) {
    return '+' + digitsOnly;
  }
  if (phone.trim().startsWith('+')) {
    return phone.replace(/[\s\(\)\-\.]/g, '');
  }
  return digitsOnly;
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

async function reevaluateCustomerDuplicates(base44, customerId) {
  const customer = await base44.asServiceRole.entities.Customer.get(customerId);
  if (!customer || customer.deleted_at) return null;

  const normalizedName = normalizeString(customer.name);
  const normalizedEmail = customer.email ? customer.email.toLowerCase().trim() : '';
  const normalizedPhone = normalizePhone(customer.phone);
  const normalizedAddress = normalizeAddress(customer);

  const allCustomers = await base44.asServiceRole.entities.Customer.filter({
    deleted_at: { $exists: false }
  });
  
  const otherCustomers = allCustomers.filter(c => c.id !== customerId);
  
  let hasDuplicates = false;
  let maxScore = 0;

  for (const other of otherCustomers) {
    const otherNormalizedName = other.normalized_name || normalizeString(other.name);
    const otherNormalizedEmail = other.normalized_email || (other.email ? other.email.toLowerCase().trim() : '');
    const otherNormalizedPhone = other.normalized_phone || normalizePhone(other.phone);
    
    let matchScore = 0;
    
    if (normalizedName && otherNormalizedName && normalizedName === otherNormalizedName) {
      matchScore++;
    }
    
    if (normalizedEmail && otherNormalizedEmail && normalizedEmail === otherNormalizedEmail) {
      matchScore++;
    }
    
    if (normalizedPhone && otherNormalizedPhone && normalizedPhone === otherNormalizedPhone) {
      matchScore++;
    }
    
    if (matchScore > 0) {
      hasDuplicates = true;
      maxScore = Math.max(maxScore, matchScore);
    }
  }

  await base44.asServiceRole.entities.Customer.update(customerId, {
    normalized_name: normalizedName,
    normalized_email: normalizedEmail || null,
    normalized_phone: normalizedPhone || null,
    normalized_address: normalizedAddress || null,
    is_potential_duplicate: hasDuplicates,
    duplicate_score: maxScore
  });

  return { id: customerId, is_potential_duplicate: hasDuplicates, duplicate_score: maxScore };
}

async function reevaluateOrganisationDuplicates(base44, organisationId) {
  const organisation = await base44.asServiceRole.entities.Organisation.get(organisationId);
  if (!organisation || organisation.deleted_at) return null;

  const normalizedName = normalizeString(organisation.name);
  const normalizedEmail = organisation.email ? organisation.email.toLowerCase().trim() : '';
  const normalizedPhone = normalizePhone(organisation.phone);

  const allOrganisations = await base44.asServiceRole.entities.Organisation.filter({
    deleted_at: { $exists: false }
  });
  
  const otherOrganisations = allOrganisations.filter(o => o.id !== organisationId);
  
  let hasDuplicates = false;
  let maxScore = 0;

  for (const other of otherOrganisations) {
    const otherNormalizedName = other.normalized_name || normalizeString(other.name);
    const otherNormalizedEmail = other.normalized_email || (other.email ? other.email.toLowerCase().trim() : '');
    const otherNormalizedPhone = other.normalized_phone || normalizePhone(other.phone);
    
    let matchScore = 0;
    const matchReasons = [];
    
    if (normalizedName && otherNormalizedName && normalizedName === otherNormalizedName) {
      matchScore++;
      matchReasons.push('name');
    }
    
    if (normalizedEmail && otherNormalizedEmail && normalizedEmail === otherNormalizedEmail) {
      matchScore++;
      matchReasons.push('email');
    }
    
    if (normalizedPhone && otherNormalizedPhone && normalizedPhone === otherNormalizedPhone) {
      matchScore++;
      matchReasons.push('phone');
    }

    const hasNameMatch = matchReasons.includes('name');
    const hasEmailMatch = matchReasons.includes('email');
    const hasPhoneMatch = matchReasons.includes('phone');
    
    const isDuplicate = 
      (hasNameMatch && hasEmailMatch) ||
      (hasNameMatch && hasPhoneMatch) ||
      (hasEmailMatch && hasPhoneMatch) ||
      (hasNameMatch && !normalizedEmail && !normalizedPhone && !otherNormalizedEmail && !otherNormalizedPhone);
    
    if (isDuplicate) {
      hasDuplicates = true;
      maxScore = Math.max(maxScore, matchScore);
    }
  }

  await base44.asServiceRole.entities.Organisation.update(organisationId, {
    normalized_name: normalizedName,
    normalized_email: normalizedEmail || null,
    normalized_phone: normalizedPhone || null,
    is_potential_duplicate: hasDuplicates,
    duplicate_score: maxScore
  });

  return { id: organisationId, is_potential_duplicate: hasDuplicates, duplicate_score: maxScore };
}

async function reevaluateProjectDuplicates(base44, projectId) {
  const project = await base44.asServiceRole.entities.Project.get(projectId);
  if (!project || project.deleted_at) return null;

  const normalizedTitle = normalizeString(project.title);
  const normalizedAddress = normalizeAddress(project);
  const customerId = project.customer_id;

  const allProjects = await base44.asServiceRole.entities.Project.filter({
    deleted_at: { $exists: false }
  });
  
  const otherProjects = allProjects.filter(p => p.id !== projectId);
  
  let hasDuplicates = false;
  let maxScore = 0;

  for (const other of otherProjects) {
    const otherNormalizedTitle = other.normalized_title || normalizeString(other.title);
    const otherNormalizedAddress = other.normalized_address || normalizeAddress(other);
    
    let matchScore = 0;
    
    if (customerId && other.customer_id === customerId &&
        normalizedAddress && otherNormalizedAddress && normalizedAddress === otherNormalizedAddress) {
      matchScore++;
    }
    
    if (normalizedTitle && otherNormalizedTitle && normalizedTitle === otherNormalizedTitle &&
        customerId && other.customer_id === customerId) {
      matchScore++;
    }
    
    if (matchScore > 0) {
      hasDuplicates = true;
      maxScore = Math.max(maxScore, matchScore);
    }
  }

  await base44.asServiceRole.entities.Project.update(projectId, {
    normalized_title: normalizedTitle,
    normalized_address: normalizedAddress || null,
    is_potential_duplicate: hasDuplicates,
    duplicate_score: maxScore
  });

  return { id: projectId, is_potential_duplicate: hasDuplicates, duplicate_score: maxScore };
}

async function reevaluateJobDuplicates(base44, jobId) {
  const job = await base44.asServiceRole.entities.Job.get(jobId);
  if (!job || job.deleted_at) return null;

  const normalizedAddress = normalizeAddress(job);
  const customerId = job.customer_id;
  const projectId = job.project_id;
  const scheduledDate = job.scheduled_date;
  const jobType = job.job_type_name || job.job_type;

  const allJobs = await base44.asServiceRole.entities.Job.filter({
    deleted_at: { $exists: false }
  });
  
  const otherJobs = allJobs.filter(j => j.id !== jobId);
  
  let hasDuplicates = false;
  let maxScore = 0;

  for (const other of otherJobs) {
    const otherNormalizedAddress = other.normalized_address || normalizeAddress(other);
    const otherJobType = other.job_type_name || other.job_type;
    
    let matchScore = 0;
    
    if (customerId && other.customer_id === customerId &&
        scheduledDate && other.scheduled_date === scheduledDate &&
        normalizedAddress && otherNormalizedAddress && normalizedAddress === otherNormalizedAddress) {
      matchScore++;
    }
    
    if (projectId && other.project_id === projectId &&
        jobType && otherJobType && jobType === otherJobType &&
        scheduledDate && other.scheduled_date === scheduledDate) {
      matchScore++;
    }
    
    if (matchScore > 0) {
      hasDuplicates = true;
      maxScore = Math.max(maxScore, matchScore);
    }
  }

  await base44.asServiceRole.entities.Job.update(jobId, {
    normalized_address: normalizedAddress || null,
    is_potential_duplicate: hasDuplicates,
    duplicate_score: maxScore
  });

  return { id: jobId, is_potential_duplicate: hasDuplicates, duplicate_score: maxScore };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entity_type, record_ids } = await req.json();

    if (!entity_type) {
      return Response.json({ error: 'entity_type is required' }, { status: 400 });
    }

    let results = [];

    if (record_ids && Array.isArray(record_ids)) {
      // Re-evaluate specific records
      for (const id of record_ids) {
        let result;
        switch (entity_type) {
          case 'Customer':
            result = await reevaluateCustomerDuplicates(base44, id);
            break;
          case 'Organisation':
            result = await reevaluateOrganisationDuplicates(base44, id);
            break;
          case 'Project':
            result = await reevaluateProjectDuplicates(base44, id);
            break;
          case 'Job':
            result = await reevaluateJobDuplicates(base44, id);
            break;
          default:
            continue;
        }
        if (result) results.push(result);
      }
    } else {
      // Re-evaluate all records with is_potential_duplicate: true
      const entities = await base44.asServiceRole.entities[entity_type].filter({
        is_potential_duplicate: true,
        deleted_at: { $exists: false }
      });

      for (const entity of entities) {
        let result;
        switch (entity_type) {
          case 'Customer':
            result = await reevaluateCustomerDuplicates(base44, entity.id);
            break;
          case 'Organisation':
            result = await reevaluateOrganisationDuplicates(base44, entity.id);
            break;
          case 'Project':
            result = await reevaluateProjectDuplicates(base44, entity.id);
            break;
          case 'Job':
            result = await reevaluateJobDuplicates(base44, entity.id);
            break;
        }
        if (result) results.push(result);
      }
    }

    return Response.json({
      success: true,
      entity_type,
      reevaluated: results.length,
      results
    });

  } catch (error) {
    console.error('Reevaluate duplicates error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});