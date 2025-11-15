import { Base44Client } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    // Initialize Base44 client with service role for webhook
    const base44 = new Base44Client({
      apiUrl: Deno.env.get('BASE44_API_URL'),
      appId: Deno.env.get('BASE44_APP_ID'),
      serviceRoleKey: Deno.env.get('BASE44_SERVICE_ROLE_KEY')
    });
    
    const payload = await req.json();
    console.log('Pipedrive webhook received:', JSON.stringify(payload, null, 2));

    // Check if this is a deal change event
    if (payload.event !== 'updated.deal' && payload.event !== 'change.deal') {
      return Response.json({ message: 'Event ignored - not a deal change' });
    }

    const deal = payload.current;
    const previous = payload.previous;

    // Check if the stage changed to "Job Booked"
    const jobBookedStageId = parseInt(Deno.env.get('PIPEDRIVE_JOB_BOOKED_STAGE_ID'));
    
    if (!jobBookedStageId) {
      return Response.json({ 
        error: 'PIPEDRIVE_JOB_BOOKED_STAGE_ID not configured' 
      }, { status: 400 });
    }

    // Only process if stage changed TO job booked (not from)
    if (deal.stage_id !== jobBookedStageId || previous.stage_id === jobBookedStageId) {
      return Response.json({ 
        message: 'Stage not changed to Job Booked - ignored',
        current_stage: deal.stage_id,
        target_stage: jobBookedStageId
      });
    }

    // Check if job already exists for this deal
    const existingJobs = await base44.entities.Job.filter({ 
      pipedrive_deal_id: deal.id.toString() 
    });

    if (existingJobs && existingJobs.length > 0) {
      return Response.json({ 
        message: 'Job already exists for this deal',
        job_id: existingJobs[0].id 
      });
    }

    // Fetch full deal details from Pipedrive to get person info
    const apiToken = Deno.env.get('PIPEDRIVE_API_TOKEN');
    const dealResponse = await fetch(
      `https://api.pipedrive.com/v1/deals/${deal.id}?api_token=${apiToken}`
    );
    const dealData = await dealResponse.json();
    const fullDeal = dealData.data;

    // Extract customer information
    const personName = fullDeal.person_name || fullDeal.person?.name || 'Unknown Customer';
    const personEmail = fullDeal.person_id?.email?.[0]?.value || '';
    const personPhone = fullDeal.person_id?.phone?.[0]?.value || '';
    
    // Get or create customer
    let customer = null;
    
    // Try to find existing customer by email or name
    if (personEmail) {
      const existingCustomers = await base44.entities.Customer.filter({ 
        email: personEmail 
      });
      if (existingCustomers && existingCustomers.length > 0) {
        customer = existingCustomers[0];
      }
    }
    
    // If no customer found, create one
    if (!customer) {
      customer = await base44.entities.Customer.create({
        name: personName,
        email: personEmail,
        phone: personPhone,
        status: 'active',
        notes: `Created from Pipedrive deal #${deal.id}`
      });
    }

    // Get the next job number
    const allJobs = await base44.entities.Job.list('-job_number', 1);
    const lastJobNumber = allJobs && allJobs[0]?.job_number ? allJobs[0].job_number : 4999;
    const newJobNumber = lastJobNumber + 1;

    // Determine scheduled date (use expected_close_date or today)
    const scheduledDate = fullDeal.expected_close_date || new Date().toISOString().split('T')[0];

    // Create the job
    const job = await base44.entities.Job.create({
      job_number: newJobNumber,
      customer_id: customer.id,
      customer_name: customer.name,
      customer_phone: customer.phone || '',
      customer_email: customer.email || '',
      customer_type: customer.customer_type || '',
      address: fullDeal.address || fullDeal['address'] || 'Address TBD',
      scheduled_date: scheduledDate,
      status: 'scheduled',
      notes: fullDeal.notes || `Deal: ${fullDeal.title}`,
      pipedrive_deal_id: deal.id.toString()
    });

    return Response.json({ 
      success: true,
      message: 'Job created successfully',
      job_id: job.id,
      job_number: job.job_number,
      customer_id: customer.id
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});