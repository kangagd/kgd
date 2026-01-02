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
      customers_updated: 0,
      projects_updated: 0,
      jobs_updated: 0
    };

    // Backfill Customers
    const customers = await base44.asServiceRole.entities.Customer.filter({
      deleted_at: { $exists: false }
    });

    for (const customer of customers) {
      const normalizedName = normalizeString(customer.name);
      const normalizedEmail = customer.email ? customer.email.toLowerCase().trim() : null;
      const normalizedPhone = normalizePhone(customer.phone);
      const normalizedAddress = normalizeAddress(customer) || null;

      // Only update if any normalized field is missing or different
      if (
        customer.normalized_name !== normalizedName ||
        customer.normalized_email !== normalizedEmail ||
        customer.normalized_phone !== normalizedPhone ||
        customer.normalized_address !== normalizedAddress
      ) {
        await base44.asServiceRole.entities.Customer.update(customer.id, {
          normalized_name: normalizedName,
          normalized_email: normalizedEmail,
          normalized_phone: normalizedPhone,
          normalized_address: normalizedAddress
        });
        results.customers_updated++;
      }
    }

    // Backfill Projects
    const projects = await base44.asServiceRole.entities.Project.filter({
      deleted_at: { $exists: false }
    });

    for (const project of projects) {
      const normalizedTitle = normalizeString(project.title);
      const normalizedAddress = normalizeAddress(project) || null;

      if (
        project.normalized_title !== normalizedTitle ||
        project.normalized_address !== normalizedAddress
      ) {
        await base44.asServiceRole.entities.Project.update(project.id, {
          normalized_title: normalizedTitle,
          normalized_address: normalizedAddress
        });
        results.projects_updated++;
      }
    }

    // Backfill Jobs
    const jobs = await base44.asServiceRole.entities.Job.filter({
      deleted_at: { $exists: false }
    });

    for (const job of jobs) {
      const normalizedAddress = normalizeAddress(job) || null;

      if (job.normalized_address !== normalizedAddress) {
        await base44.asServiceRole.entities.Job.update(job.id, {
          normalized_address: normalizedAddress
        });
        results.jobs_updated++;
      }
    }

    return Response.json({
      success: true,
      message: 'Normalized fields backfilled successfully',
      ...results
    });

  } catch (error) {
    console.error('Backfill normalized fields error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});