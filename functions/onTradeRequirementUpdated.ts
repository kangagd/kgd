import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tradeId, wasBooked, isBooked } = await req.json();

    // Only proceed if is_booked changed from false to true
    if (wasBooked || !isBooked) {
      return Response.json({ 
        message: 'No action needed - trade not newly booked',
        created: false 
      });
    }

    // Fetch the trade requirement
    const trade = await base44.asServiceRole.entities.ProjectTradeRequirement.get(tradeId);
    if (!trade) {
      return Response.json({ error: 'Trade requirement not found' }, { status: 404 });
    }

    // Fetch the project
    const project = await base44.asServiceRole.entities.Project.get(trade.project_id);
    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if a logistics job already exists for this trade
    const existingJobs = await base44.asServiceRole.entities.Job.filter({
      third_party_trade_id: tradeId,
    });

    // Build job data
    const jobTypeName = `Third-party – ${trade.trade_type || 'Trade'}`;
    const address = project.address_full || project.address || '';
    
    // Build comprehensive notes
    let notes = `Third-party ${trade.trade_type || 'Trade'}`;
    if (trade.description) {
      notes += `\n\nDescription: ${trade.description}`;
    }
    if (trade.contact_name || trade.contact_phone || trade.contact_email) {
      notes += `\n\nContact:`;
      if (trade.contact_name) notes += `\nName: ${trade.contact_name}`;
      if (trade.contact_phone) notes += `\nPhone: ${trade.contact_phone}`;
      if (trade.contact_email) notes += `\nEmail: ${trade.contact_email}`;
    }
    if (trade.notes_for_site) {
      notes += `\n\nSite Notes: ${trade.notes_for_site}`;
    }

    const jobData = {
      project_id: trade.project_id,
      third_party_trade_id: tradeId,
      job_type_name: jobTypeName,
      status: 'Open',
      address_full: address,
      address: address, // For backward compatibility
      customer_id: project.customer_id,
      customer_name: project.customer_name,
      notes: notes,
      is_logistics_job: true,
      logistics_purpose: "manual_client_dropoff",
      origin_address: "866 Bourke Street, Waterloo",
      destination_address: address || "Client Site",
    };

    let result;
    if (existingJobs && existingJobs.length > 0) {
      // Update existing job
      const existingJob = existingJobs[0];
      await base44.asServiceRole.entities.Job.update(existingJob.id, jobData);
      result = {
        message: 'Logistics job updated',
        jobId: existingJob.id,
        created: false,
        updated: true
      };
    } else {
      // Create new job
      const newJob = await base44.asServiceRole.entities.Job.create(jobData);
      result = {
        message: 'Logistics job created',
        jobId: newJob.id,
        created: true,
        updated: false
      };
    }

    return Response.json(result);
  } catch (error) {
    console.error('Trade requirement update error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});