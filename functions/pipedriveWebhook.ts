import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    
    // Pipedrive webhook event
    const event = body.event;
    const current = body.current;
    const previous = body.previous;
    
    console.log('Pipedrive webhook received:', event);
    
    // Handle deal stage changes
    if (event === 'updated.deal' && current && previous) {
      const currentStage = current.stage_id;
      const previousStage = previous.stage_id;
      
      // Check if deal moved to "Job Booked" stage
      // You'll need to replace this with your actual "Job Booked" stage ID from Pipedrive
      const JOB_BOOKED_STAGE_ID = parseInt(Deno.env.get('PIPEDRIVE_JOB_BOOKED_STAGE_ID') || '0');
      
      if (currentStage === JOB_BOOKED_STAGE_ID && currentStage !== previousStage) {
        console.log('Deal moved to Job Booked stage:', current.id);
        
        // Fetch full deal details from Pipedrive
        const dealId = current.id;
        const apiToken = Deno.env.get('PIPEDRIVE_API_TOKEN');
        
        const dealResponse = await fetch(
          `https://api.pipedrive.com/v1/deals/${dealId}?api_token=${apiToken}`
        );
        const dealData = await dealResponse.json();
        
        if (!dealData.success) {
          throw new Error('Failed to fetch deal from Pipedrive');
        }
        
        const deal = dealData.data;
        
        // Fetch person (contact) details
        let personData = null;
        if (deal.person_id) {
          const personResponse = await fetch(
            `https://api.pipedrive.com/v1/persons/${deal.person_id}?api_token=${apiToken}`
          );
          const personResult = await personResponse.json();
          if (personResult.success) {
            personData = personResult.data;
          }
        }
        
        // Check if job already exists for this deal
        const existingJobs = await base44.asServiceRole.entities.Job.filter({
          pipedrive_deal_id: dealId.toString()
        });
        
        if (existingJobs.length > 0) {
          console.log('Job already exists for deal:', dealId);
          return Response.json({ 
            success: true, 
            message: 'Job already exists',
            job_id: existingJobs[0].id 
          });
        }
        
        // Find or create customer
        let customer = null;
        const customerName = personData?.name || deal.person_name || deal.title;
        const customerEmail = personData?.email?.[0]?.value || '';
        const customerPhone = personData?.phone?.[0]?.value || '';
        
        // Try to find existing customer by email or phone
        if (customerEmail) {
          const existingCustomers = await base44.asServiceRole.entities.Customer.filter({
            email: customerEmail
          });
          if (existingCustomers.length > 0) {
            customer = existingCustomers[0];
          }
        }
        
        if (!customer && customerPhone) {
          const existingCustomers = await base44.asServiceRole.entities.Customer.filter({
            phone: customerPhone
          });
          if (existingCustomers.length > 0) {
            customer = existingCustomers[0];
          }
        }
        
        // Create customer if not found
        if (!customer) {
          customer = await base44.asServiceRole.entities.Customer.create({
            name: customerName,
            email: customerEmail,
            phone: customerPhone,
            status: 'active',
            notes: `Imported from Pipedrive deal #${dealId}`
          });
        }
        
        // Get the latest job number
        const allJobs = await base44.asServiceRole.entities.Job.list('-job_number', 1);
        const lastJobNumber = allJobs && allJobs[0]?.job_number ? allJobs[0].job_number : 4999;
        const newJobNumber = lastJobNumber + 1;
        
        // Extract address from deal
        const address = deal.org_address || personData?.address || deal.title || 'Address TBD';
        
        // Parse expected close date for scheduled date
        const scheduledDate = deal.expected_close_date || new Date().toISOString().split('T')[0];
        
        // Create job
        const job = await base44.asServiceRole.entities.Job.create({
          job_number: newJobNumber,
          customer_id: customer.id,
          customer_name: customer.name,
          customer_phone: customer.phone || '',
          customer_email: customer.email || '',
          customer_type: customer.customer_type || '',
          address: address,
          scheduled_date: scheduledDate,
          status: 'scheduled',
          priority: 'medium',
          notes: deal.notes || `Imported from Pipedrive\nDeal: ${deal.title}\nValue: $${deal.value || 0}`,
          pipedrive_deal_id: dealId.toString()
        });
        
        console.log('Created job:', job.id, 'for deal:', dealId);
        
        // Update deal in Pipedrive with job number
        await fetch(
          `https://api.pipedrive.com/v1/deals/${dealId}?api_token=${apiToken}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              '${Deno.env.get('PIPEDRIVE_JOB_NUMBER_FIELD_KEY') || 'job_number'}': `#${newJobNumber}`
            })
          }
        );
        
        return Response.json({ 
          success: true, 
          message: 'Job created successfully',
          job_id: job.id,
          job_number: newJobNumber
        });
      }
    }
    
    // Handle deal updates to sync status changes
    if (event === 'updated.deal' && current) {
      const dealId = current.id;
      const existingJobs = await base44.asServiceRole.entities.Job.filter({
        pipedrive_deal_id: dealId.toString()
      });
      
      if (existingJobs.length > 0) {
        const job = existingJobs[0];
        
        // Map Pipedrive status to job status
        let newStatus = job.status;
        if (current.status === 'won') {
          newStatus = 'completed';
        } else if (current.status === 'lost') {
          newStatus = 'cancelled';
        }
        
        if (newStatus !== job.status) {
          await base44.asServiceRole.entities.Job.update(job.id, {
            status: newStatus
          });
          console.log('Updated job status:', job.id, 'to', newStatus);
        }
      }
    }
    
    return Response.json({ success: true, message: 'Webhook processed' });
    
  } catch (error) {
    console.error('Webhook error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});