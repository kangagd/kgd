import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchTerm, filters } = await req.json();

    if (!searchTerm || searchTerm.trim().length === 0) {
      return Response.json({ 
        jobs: [], 
        customers: [], 
        projects: [], 
        organisations: [],
        priceListItems: []
      });
    }

    const term = searchTerm;
    const isTechnician = user.is_field_technician && user.role !== 'admin';

    // Build queries for database-level filtering
    const jobQuery = {
      $or: [
        { job_number: { $regex: term, $options: 'i' } },
        { customer_name: { $regex: term, $options: 'i' } },
        { address_full: { $regex: term, $options: 'i' } },
        { address_suburb: { $regex: term, $options: 'i' } },
        { job_type: { $regex: term, $options: 'i' } },
        { notes: { $regex: term, $options: 'i' } }
      ],
      deleted_at: { $exists: false }
    };

    if (isTechnician) {
      jobQuery.assigned_to = user.email;
    }
    if (filters?.status && filters.status !== 'all') {
      jobQuery.status = filters.status;
    }
    if (filters?.technician && filters.technician !== 'all') {
      jobQuery.assigned_to = filters.technician;
    }
    if (filters?.dateFrom) {
      jobQuery.scheduled_date = { $gte: filters.dateFrom };
    }
    if (filters?.dateTo) {
      jobQuery.scheduled_date = { ...jobQuery.scheduled_date, $lte: filters.dateTo };
    }

    const customerQuery = {
      $or: [
        { name: { $regex: term, $options: 'i' } },
        { email: { $regex: term, $options: 'i' } },
        { phone: { $regex: term, $options: 'i' } },
        { address_full: { $regex: term, $options: 'i' } },
        { address_suburb: { $regex: term, $options: 'i' } }
      ],
      deleted_at: { $exists: false }
    };

    const projectQuery = {
      $or: [
        { title: { $regex: term, $options: 'i' } },
        { customer_name: { $regex: term, $options: 'i' } },
        { address_full: { $regex: term, $options: 'i' } },
        { address_suburb: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } }
      ],
      deleted_at: { $exists: false }
    };

    if (filters?.status && filters.status !== 'all') {
      projectQuery.status = filters.status;
    }
    if (filters?.technician && filters.technician !== 'all') {
      projectQuery.assigned_technicians = filters.technician;
    }

    const organisationQuery = {
      $or: [
        { name: { $regex: term, $options: 'i' } },
        { email: { $regex: term, $options: 'i' } },
        { phone: { $regex: term, $options: 'i' } },
        { sp_number: { $regex: term, $options: 'i' } },
        { address_full: { $regex: term, $options: 'i' } }
      ],
      deleted_at: { $exists: false }
    };

    const priceListQuery = {
      $or: [
        { item: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } },
        { category: { $regex: term, $options: 'i' } }
      ]
    };

    // Execute all queries in parallel
    const [jobs, customers, projects, organisations, priceListItems] = await Promise.all([
      base44.entities.Job.filter(jobQuery, '-created_date', 50),
      base44.entities.Customer.filter(customerQuery, '-created_date', 50),
      base44.entities.Project.filter(projectQuery, '-created_date', 50),
      base44.entities.Organisation.filter(organisationQuery, '-created_date', 30),
      base44.entities.PriceListItem.filter(priceListQuery, null, 30)
    ]);

    return Response.json({
      jobs,
      customers,
      projects,
      organisations,
      priceListItems
    });

  } catch (error) {
    console.error('Search error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});