import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const results = {
      customers_checked: 0,
      customers_with_duplicates: 0,
      customers_cleared: 0,
      projects_checked: 0,
      projects_with_duplicates: 0,
      projects_cleared: 0,
      jobs_checked: 0,
      jobs_with_duplicates: 0,
      jobs_cleared: 0,
      organisations_checked: 0,
      organisations_with_duplicates: 0,
      organisations_cleared: 0
    };

    // Recheck all Customers
    const allCustomers = await base44.asServiceRole.entities.Customer.list();
    const customers = allCustomers.filter(c => !c.deleted_at);

    for (const customer of customers) {
      const normalizedName = customer.normalized_name || normalizeString(customer.name);
      const normalizedEmail = customer.normalized_email || (customer.email ? customer.email.toLowerCase().trim() : '');
      const normalizedPhone = customer.normalized_phone || normalizePhone(customer.phone);
      
      // Find duplicates
      const otherCustomers = customers.filter(c => c.id !== customer.id);
      let hasDuplicate = false;
      let maxScore = 0;
      
      for (const other of otherCustomers) {
        const otherNormalizedName = other.normalized_name || normalizeString(other.name);
        const otherNormalizedEmail = other.normalized_email || (other.email ? other.email.toLowerCase().trim() : '');
        const otherNormalizedPhone = other.normalized_phone || normalizePhone(other.phone);
        
        let score = 0;
        if (normalizedName && otherNormalizedName && normalizedName === otherNormalizedName) score++;
        if (normalizedEmail && otherNormalizedEmail && normalizedEmail === otherNormalizedEmail) score++;
        if (normalizedPhone && otherNormalizedPhone && normalizedPhone === otherNormalizedPhone) score++;
        
        if (score > 0) {
          hasDuplicate = true;
          maxScore = Math.max(maxScore, score);
        }
      }
      
      await base44.asServiceRole.entities.Customer.update(customer.id, {
        is_potential_duplicate: hasDuplicate,
        duplicate_score: maxScore
      });
      
      results.customers_checked++;
      if (hasDuplicate) {
        results.customers_with_duplicates++;
      } else if (customer.is_potential_duplicate) {
        results.customers_cleared++;
      }
    }

    // Recheck all Projects
    const allProjects = await base44.asServiceRole.entities.Project.list();
    const projects = allProjects.filter(p => !p.deleted_at);

    for (const project of projects) {
      const normalizedTitle = project.normalized_title || normalizeString(project.title);
      const normalizedAddress = project.normalized_address || normalizeAddress(project);
      
      // Find duplicates
      const otherProjects = projects.filter(p => p.id !== project.id);
      let hasDuplicate = false;
      let maxScore = 0;
      
      for (const other of otherProjects) {
        const otherNormalizedTitle = other.normalized_title || normalizeString(other.title);
        const otherNormalizedAddress = other.normalized_address || normalizeAddress(other);
        
        let score = 0;
        if (project.customer_id && other.customer_id === project.customer_id &&
            normalizedAddress && otherNormalizedAddress && normalizedAddress === otherNormalizedAddress) {
          score++;
        }
        if (normalizedTitle && otherNormalizedTitle && normalizedTitle === otherNormalizedTitle &&
            project.customer_id && other.customer_id === project.customer_id) {
          score++;
        }
        
        if (score > 0) {
          hasDuplicate = true;
          maxScore = Math.max(maxScore, score);
        }
      }
      
      await base44.asServiceRole.entities.Project.update(project.id, {
        is_potential_duplicate: hasDuplicate,
        duplicate_score: maxScore
      });
      
      results.projects_checked++;
      if (hasDuplicate) {
        results.projects_with_duplicates++;
      } else if (project.is_potential_duplicate) {
        results.projects_cleared++;
      }
    }

    // Recheck all Jobs
    const allJobs = await base44.asServiceRole.entities.Job.list();
    const jobs = allJobs.filter(j => !j.deleted_at);

    for (const job of jobs) {
      const normalizedAddress = job.normalized_address || normalizeAddress(job);
      
      // Find duplicates
      const otherJobs = jobs.filter(j => j.id !== job.id);
      let hasDuplicate = false;
      let maxScore = 0;
      
      for (const other of otherJobs) {
        const otherNormalizedAddress = other.normalized_address || normalizeAddress(other);
        const otherJobType = other.job_type_name || other.job_type;
        const jobType = job.job_type_name || job.job_type;
        
        let score = 0;
        if (job.customer_id && other.customer_id === job.customer_id &&
            job.scheduled_date && other.scheduled_date === job.scheduled_date &&
            normalizedAddress && otherNormalizedAddress && normalizedAddress === otherNormalizedAddress) {
          score++;
        }
        if (job.project_id && other.project_id === job.project_id &&
            jobType && otherJobType && jobType === otherJobType &&
            job.scheduled_date && other.scheduled_date === job.scheduled_date) {
          score++;
        }
        
        if (score > 0) {
          hasDuplicate = true;
          maxScore = Math.max(maxScore, score);
        }
      }
      
      await base44.asServiceRole.entities.Job.update(job.id, {
        is_potential_duplicate: hasDuplicate,
        duplicate_score: maxScore
      });
      
      results.jobs_checked++;
      if (hasDuplicate) {
        results.jobs_with_duplicates++;
      } else if (job.is_potential_duplicate) {
        results.jobs_cleared++;
      }
    }

    // Recheck all Organisations
    const allOrganisations = await base44.asServiceRole.entities.Organisation.list();
    const organisations = allOrganisations.filter(o => !o.deleted_at);

    for (const organisation of organisations) {
      const normalizedName = organisation.normalized_name || normalizeString(organisation.name);
      const normalizedEmail = organisation.normalized_email || (organisation.email ? organisation.email.toLowerCase().trim() : '');
      const normalizedPhone = organisation.normalized_phone || normalizePhone(organisation.phone);
      
      // Find duplicates
      const otherOrganisations = organisations.filter(o => o.id !== organisation.id);
      let hasDuplicate = false;
      let maxScore = 0;
      
      for (const other of otherOrganisations) {
        const otherNormalizedName = other.normalized_name || normalizeString(other.name);
        const otherNormalizedEmail = other.normalized_email || (other.email ? other.email.toLowerCase().trim() : '');
        const otherNormalizedPhone = other.normalized_phone || normalizePhone(other.phone);
        
        let score = 0;
        if (normalizedName && otherNormalizedName && normalizedName === otherNormalizedName) score++;
        if (normalizedEmail && otherNormalizedEmail && normalizedEmail === otherNormalizedEmail) score++;
        if (normalizedPhone && otherNormalizedPhone && normalizedPhone === otherNormalizedPhone) score++;
        
        if (score > 0) {
          hasDuplicate = true;
          maxScore = Math.max(maxScore, score);
        }
      }
      
      await base44.asServiceRole.entities.Organisation.update(organisation.id, {
        is_potential_duplicate: hasDuplicate,
        duplicate_score: maxScore
      });
      
      results.organisations_checked++;
      if (hasDuplicate) {
        results.organisations_with_duplicates++;
      } else if (organisation.is_potential_duplicate) {
        results.organisations_cleared++;
      }
    }

    return Response.json({
      success: true,
      message: 'All duplicate checks completed',
      ...results
    });

  } catch (error) {
    console.error('Recheck all duplicates error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});