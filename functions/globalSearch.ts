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

    const term = searchTerm.toLowerCase();
    const isTechnician = user.is_field_technician && user.role !== 'admin';

    // Fetch all entities in parallel
    const [allJobs, allCustomers, allProjects, allOrganisations, allPriceListItems] = await Promise.all([
      base44.entities.Job.list(),
      base44.entities.Customer.list(),
      base44.entities.Project.list(),
      base44.entities.Organisation.list(),
      base44.entities.PriceListItem.list()
    ]);

    // Filter jobs
    let jobs = allJobs.filter(job => 
      !job.deleted_at && (
        job.job_number?.toString().includes(term) ||
        job.customer_name?.toLowerCase().includes(term) ||
        job.address_full?.toLowerCase().includes(term) ||
        job.address_suburb?.toLowerCase().includes(term) ||
        job.job_type?.toLowerCase().includes(term) ||
        job.notes?.toLowerCase().includes(term)
      )
    );

    // Technician access control
    if (isTechnician) {
      jobs = jobs.filter(job => {
        const assignedTo = Array.isArray(job.assigned_to) ? job.assigned_to : [job.assigned_to];
        return assignedTo.includes(user.email);
      });
    }

    // Apply filters to jobs
    if (filters?.status && filters.status !== 'all') {
      jobs = jobs.filter(job => job.status === filters.status);
    }
    if (filters?.technician && filters.technician !== 'all') {
      jobs = jobs.filter(job => {
        const assignedTo = Array.isArray(job.assigned_to) ? job.assigned_to : [job.assigned_to];
        return assignedTo.includes(filters.technician);
      });
    }
    if (filters?.dateFrom) {
      jobs = jobs.filter(job => !job.scheduled_date || job.scheduled_date >= filters.dateFrom);
    }
    if (filters?.dateTo) {
      jobs = jobs.filter(job => !job.scheduled_date || job.scheduled_date <= filters.dateTo);
    }

    // Filter customers
    const customers = allCustomers.filter(customer =>
      !customer.deleted_at && (
        customer.name?.toLowerCase().includes(term) ||
        customer.email?.toLowerCase().includes(term) ||
        customer.phone?.includes(term) ||
        customer.address_full?.toLowerCase().includes(term) ||
        customer.address_suburb?.toLowerCase().includes(term)
      )
    );

    // Filter projects
    let projects = allProjects.filter(project =>
      !project.deleted_at && (
        project.title?.toLowerCase().includes(term) ||
        project.customer_name?.toLowerCase().includes(term) ||
        project.address_full?.toLowerCase().includes(term) ||
        project.address_suburb?.toLowerCase().includes(term) ||
        project.description?.toLowerCase().includes(term)
      )
    );

    // Apply filters to projects
    if (filters?.status && filters.status !== 'all') {
      projects = projects.filter(project => project.status === filters.status);
    }
    if (filters?.technician && filters.technician !== 'all') {
      projects = projects.filter(project => {
        const assignedTechs = Array.isArray(project.assigned_technicians) ? project.assigned_technicians : [];
        return assignedTechs.includes(filters.technician);
      });
    }

    // Filter organisations
    const organisations = allOrganisations.filter(org =>
      !org.deleted_at && (
        org.name?.toLowerCase().includes(term) ||
        org.email?.toLowerCase().includes(term) ||
        org.phone?.includes(term) ||
        org.sp_number?.includes(term) ||
        org.address_full?.toLowerCase().includes(term)
      )
    );

    // Filter price list items
    const priceListItems = allPriceListItems.filter(item =>
      item.item?.toLowerCase().includes(term) ||
      item.description?.toLowerCase().includes(term) ||
      item.category?.toLowerCase().includes(term)
    );

    return Response.json({
      jobs: jobs.slice(0, 50),
      customers: customers.slice(0, 50),
      projects: projects.slice(0, 50),
      organisations: organisations.slice(0, 30),
      priceListItems: priceListItems.slice(0, 30)
    });

  } catch (error) {
    console.error('Search error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});