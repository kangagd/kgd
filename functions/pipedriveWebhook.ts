// Updated: 2025-11-15 - Direct Base44 initialization for webhook
import { Base44 } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    // Initialize Base44 with service role (webhooks don't have user auth)
    const base44 = new Base44({
      url: Deno.env.get('BASE44_API_URL'),
      apiKey: Deno.env.get('BASE44_SERVICE_ROLE_KEY')
    });
    
    const body = await req.json();
    
    const event = body.event;
    const current = body.current;
    const previous = body.previous;
    
    console.log('=== Pipedrive webhook ===');
    console.log('Event:', event);
    console.log('Stage change:', previous?.stage_id, '→', current?.stage_id);
    
    // Handle deal stage changes
    if ((event === 'updated.deal' || event === 'changed.deal') && current && previous) {
      const currentStage = current.stage_id;
      const previousStage = previous.stage_id;
      const JOB_BOOKED_STAGE_ID = parseInt(Deno.env.get('PIPEDRIVE_JOB_BOOKED_STAGE_ID') || '0');
      
      if (currentStage === JOB_BOOKED_STAGE_ID && currentStage !== previousStage) {
        console.log('✓ Deal moved to Job Booked:', current.id);
        
        const dealId = current.id;
        const apiToken = Deno.env.get('PIPEDRIVE_API_TOKEN');
        
        if (!apiToken) {
          return Response.json({ error: 'API token not configured' }, { status: 500 });
        }
        
        // Fetch deal details
        const dealResponse = await fetch(
          `https://api.pipedrive.com/v1/deals/${dealId}?api_token=${apiToken}`
        );
        
        if (!dealResponse.ok) {
          return Response.json({ error: 'Failed to fetch deal' }, { status: dealResponse.status });
        }
        
        const dealData = await dealResponse.json();
        if (!dealData.success) {
          throw new Error('Pipedrive API error');
        }
        
        const deal = dealData.data;
        
        // Fetch person details
        let personData = null;
        if (deal.person_id) {
          try {
            const personResponse = await fetch(
              `https://api.pipedrive.com/v1/persons/${deal.person_id}?api_token=${apiToken}`
            );
            if (personResponse.ok) {
              const personResult = await personResponse.json();
              if (personResult.success) {
                personData = personResult.data;
              }
            }
          } catch (e) {
            console.warn('Could not fetch person:', e.message);
          }
        }
        
        // Check if job exists
        const existingJobs = await base44.entities.Job.filter({
          pipedrive_deal_id: dealId.toString()
        });
        
        if (existingJobs.length > 0) {
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
        
        if (customerEmail) {
          const existing = await base44.entities.Customer.filter({ email: customerEmail });
          if (existing.length > 0) {
            customer = existing[0];
          }
        }
        
        if (!customer && customerPhone) {
          const existing = await base44.entities.Customer.filter({ phone: customerPhone });
          if (existing.length > 0) {
            customer = existing[0];
          }
        }
        
        if (!customer) {
          customer = await base44.entities.Customer.create({
            name: customerName,
            email: customerEmail,
            phone: customerPhone,
            status: 'active',
            notes: `Imported from Pipedrive deal #${dealId}`
          });
          console.log('✓ Created customer:', customer.id);
        }
        
        // Get next job number
        const allJobs = await base44.entities.Job.list('-job_number', 1);
        const lastJobNumber = allJobs?.[0]?.job_number || 4999;
        const newJobNumber = lastJobNumber + 1;
        
        const address = deal.org_address || personData?.address || deal.title || 'TBD';
        const scheduledDate = deal.expected_close_date || new Date().toISOString().split('T')[0];
        
        // Create job
        const job = await base44.entities.Job.create({
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
          notes: `Imported from Pipedrive\nDeal: ${deal.title}\nValue: $${deal.value || 0}`,
          pipedrive_deal_id: dealId.toString()
        });
        
        console.log('✓✓✓ Created job:', job.id, '#', newJobNumber);
        
        // Update Pipedrive with job number
        try {
          await fetch(
            `https://api.pipedrive.com/v1/deals/${dealId}?api_token=${apiToken}`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                [Deno.env.get('PIPEDRIVE_JOB_NUMBER_FIELD_KEY') || 'job_number']: `#${newJobNumber}`
              })
            }
          );
        } catch (e) {
          console.warn('Could not update Pipedrive:', e.message);
        }
        
        return Response.json({ 
          success: true, 
          job_id: job.id,
          job_number: newJobNumber
        });
      }
    }
    
    // Sync status changes
    if ((event === 'updated.deal' || event === 'changed.deal') && current) {
      const existingJobs = await base44.entities.Job.filter({
        pipedrive_deal_id: current.id.toString()
      });
      
      if (existingJobs.length > 0) {
        const job = existingJobs[0];
        let newStatus = job.status;
        
        if (current.status === 'won') {
          newStatus = 'completed';
        } else if (current.status === 'lost') {
          newStatus = 'cancelled';
        }
        
        if (newStatus !== job.status) {
          await base44.entities.Job.update(job.id, { status: newStatus });
          console.log('✓ Updated job status:', newStatus);
        }
      }
    }
    
    return Response.json({ success: true });
    
  } catch (error) {
    console.error('WEBHOOK ERROR:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});