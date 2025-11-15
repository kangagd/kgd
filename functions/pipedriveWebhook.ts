import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    
    // Pipedrive webhook event
    const event = body.event;
    const current = body.current;
    const previous = body.previous;
    
    console.log('=== Pipedrive webhook received ===');
    console.log('Event:', event);
    console.log('Current stage_id:', current?.stage_id);
    console.log('Previous stage_id:', previous?.stage_id);
    console.log('Full body:', JSON.stringify(body, null, 2));
    
    // Handle deal stage changes
    if (event === 'updated.deal' && current && previous) {
      const currentStage = current.stage_id;
      const previousStage = previous.stage_id;
      
      // Check if deal moved to "Job Booked" stage
      const JOB_BOOKED_STAGE_ID = parseInt(Deno.env.get('PIPEDRIVE_JOB_BOOKED_STAGE_ID') || '0');
      
      console.log('Job Booked Stage ID from env:', JOB_BOOKED_STAGE_ID);
      console.log('Stage changed?', currentStage !== previousStage);
      console.log('Matches Job Booked stage?', currentStage === JOB_BOOKED_STAGE_ID);
      
      if (currentStage === JOB_BOOKED_STAGE_ID && currentStage !== previousStage) {
        console.log('✓ Deal moved to Job Booked stage:', current.id);
        
        const dealId = current.id;
        const apiToken = Deno.env.get('PIPEDRIVE_API_TOKEN');
        
        if (!apiToken) {
          console.error('PIPEDRIVE_API_TOKEN not set');
          return Response.json({ 
            success: false, 
            error: 'Pipedrive API token not configured' 
          }, { status: 500 });
        }
        
        try {
          // Fetch full deal details from Pipedrive
          const dealResponse = await fetch(
            `https://api.pipedrive.com/v1/deals/${dealId}?api_token=${apiToken}`
          );
          
          if (dealResponse.status === 401) {
            console.error('Pipedrive authentication failed');
            return Response.json({ 
              success: false, 
              error: 'Invalid Pipedrive API token' 
            }, { status: 401 });
          }
          
          if (dealResponse.status === 429) {
            console.error('Pipedrive API rate limit exceeded');
            return Response.json({ 
              success: false, 
              error: 'Pipedrive API rate limit exceeded. Please try again later.' 
            }, { status: 429 });
          }
          
          if (!dealResponse.ok) {
            console.error('Failed to fetch deal from Pipedrive:', dealResponse.status);
            return Response.json({ 
              success: false, 
              error: `Pipedrive API error: ${dealResponse.status}` 
            }, { status: dealResponse.status });
          }
          
          const dealData = await dealResponse.json();
          
          if (!dealData.success) {
            throw new Error('Pipedrive returned unsuccessful response');
          }
          
          const deal = dealData.data;
          console.log('✓ Fetched deal from Pipedrive:', deal.title);
          
          // Fetch person (contact) details
          let personData = null;
          if (deal.person_id) {
            try {
              const personResponse = await fetch(
                `https://api.pipedrive.com/v1/persons/${deal.person_id}?api_token=${apiToken}`
              );
              
              if (personResponse.status === 429) {
                console.warn('Rate limit hit while fetching person, continuing without person data');
              } else if (personResponse.ok) {
                const personResult = await personResponse.json();
                if (personResult.success) {
                  personData = personResult.data;
                  console.log('✓ Fetched person data:', personData.name);
                }
              }
            } catch (personError) {
              console.warn('Failed to fetch person data, continuing without it:', personError.message);
            }
          }
          
          // Check if job already exists for this deal
          const existingJobs = await base44.asServiceRole.entities.Job.filter({
            pipedrive_deal_id: dealId.toString()
          });
          
          if (existingJobs.length > 0) {
            console.log('! Job already exists for deal:', dealId);
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
          
          console.log('Customer data:', { customerName, customerEmail, customerPhone });
          
          // Try to find existing customer by email or phone
          if (customerEmail) {
            const existingCustomers = await base44.asServiceRole.entities.Customer.filter({
              email: customerEmail
            });
            if (existingCustomers.length > 0) {
              customer = existingCustomers[0];
              console.log('✓ Found existing customer by email:', customer.id);
            }
          }
          
          if (!customer && customerPhone) {
            const existingCustomers = await base44.asServiceRole.entities.Customer.filter({
              phone: customerPhone
            });
            if (existingCustomers.length > 0) {
              customer = existingCustomers[0];
              console.log('✓ Found existing customer by phone:', customer.id);
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
            console.log('✓ Created new customer:', customer.id);
          }
          
          // Get the latest job number
          const allJobs = await base44.asServiceRole.entities.Job.list('-job_number', 1);
          const lastJobNumber = allJobs && allJobs[0]?.job_number ? allJobs[0].job_number : 4999;
          const newJobNumber = lastJobNumber + 1;
          
          // Extract address from deal
          const address = deal.org_address || personData?.address || deal.title || 'Address TBD';
          
          // Parse expected close date for scheduled date
          const scheduledDate = deal.expected_close_date || new Date().toISOString().split('T')[0];
          
          console.log('Creating job with:', { newJobNumber, address, scheduledDate });
          
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
          
          console.log('✓✓✓ SUCCESS: Created job:', job.id, 'Job #', newJobNumber);
          
          // Update deal in Pipedrive with job number
          try {
            const updateResponse = await fetch(
              `https://api.pipedrive.com/v1/deals/${dealId}?api_token=${apiToken}`,
              {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  [Deno.env.get('PIPEDRIVE_JOB_NUMBER_FIELD_KEY') || 'job_number']: `#${newJobNumber}`
                })
              }
            );
            
            if (updateResponse.status === 429) {
              console.warn('Rate limit hit while updating deal with job number');
            } else if (!updateResponse.ok) {
              console.warn('Failed to update deal with job number:', updateResponse.status);
            } else {
              console.log('✓ Updated Pipedrive deal with job number');
            }
          } catch (updateError) {
            console.warn('Failed to update deal with job number:', updateError.message);
          }
          
          return Response.json({ 
            success: true, 
            message: 'Job created successfully',
            job_id: job.id,
            job_number: newJobNumber
          });
          
        } catch (pipedriveError) {
          console.error('ERROR processing Pipedrive deal:', pipedriveError);
          return Response.json({ 
            success: false, 
            error: `Failed to process deal: ${pipedriveError.message}` 
          }, { status: 500 });
        }
      } else {
        console.log('× Stage change not matching criteria');
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
          console.log('✓ Updated job status:', job.id, 'to', newStatus);
        }
      }
    }
    
    return Response.json({ success: true, message: 'Webhook processed' });
    
  } catch (error) {
    console.error('WEBHOOK ERROR:', error);
    return Response.json({ 
      success: false, 
      error: `Internal error: ${error.message}` 
    }, { status: 500 });
  }
});