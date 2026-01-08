import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { updateProjectActivity } from './updateProjectActivity.js';

Deno.serve(async (req) => {
  try {
    // Validate PandaDoc webhook signature for security
    const pandadocApiKey = Deno.env.get('PANDADOC_API_KEY');
    const signature = req.headers.get('x-pandadoc-signature');
    const timestamp = req.headers.get('x-pandadoc-timestamp');
    
    if (!signature || !timestamp) {
      console.error('Missing PandaDoc webhook signature or timestamp');
      return Response.json({ error: 'Invalid webhook' }, { status: 401 });
    }

    const base44 = createClientFromRequest(req);
    const bodyText = await req.text();
    const body = JSON.parse(bodyText);

    // Verify webhook signature using HMAC-SHA256
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(pandadocApiKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureData = encoder.encode(`${timestamp}:${bodyText}`);
    const expectedSignature = await crypto.subtle.sign('HMAC', key, signatureData);
    const expectedHex = Array.from(new Uint8Array(expectedSignature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    if (signature !== expectedHex) {
      console.error('Invalid PandaDoc webhook signature');
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }
    console.log('PandaDoc webhook received:', JSON.stringify(body));

    // PandaDoc sends events in this format
    const events = Array.isArray(body) ? body : [body];

    for (const event of events) {
      const documentId = event.data?.id || event.document?.id;
      const eventType = event.event || event.name;

      if (!documentId) {
        console.log('No document ID in webhook event');
        continue;
      }

      // Find the quote by PandaDoc document ID
      const quotes = await base44.asServiceRole.entities.Quote.filter({
        pandadoc_document_id: documentId
      });

      const quote = quotes[0];
      if (!quote) {
        console.log(`No quote found for PandaDoc document ${documentId}`);
        continue;
      }

      const updates = {};
      const now = new Date().toISOString();

      // Map PandaDoc events to our status
      switch (eventType) {
        case 'document_state_changed':
          const newState = event.data?.status || event.document?.status;
          
          if (newState === 'document.sent') {
            updates.status = 'Sent';
            if (!quote.sent_at) updates.sent_at = now;
          } else if (newState === 'document.viewed') {
            updates.status = 'Viewed';
            if (!quote.viewed_at) updates.viewed_at = now;
          } else if (newState === 'document.completed') {
            updates.status = 'Accepted';
            updates.accepted_at = now;
            
            // Update project status if linked
            if (quote.project_id) {
              try {
                await base44.asServiceRole.entities.Project.update(quote.project_id, {
                  status: 'Quote Approved'
                });
                console.log(`Updated project ${quote.project_id} to Quote Approved`);
              } catch (err) {
                console.error('Failed to update project status:', err);
              }
            }
          } else if (newState === 'document.declined' || newState === 'document.voided') {
            updates.status = 'Declined';
            updates.declined_at = now;
          }
          break;

        case 'document_sent':
          updates.status = 'Sent';
          if (!quote.sent_at) updates.sent_at = now;
          break;

        case 'document_viewed':
        case 'recipient_viewed':
          if (quote.status === 'Sent' || quote.status === 'Draft') {
            updates.status = 'Viewed';
          }
          if (!quote.viewed_at) updates.viewed_at = now;
          break;

        case 'document_completed':
        case 'recipient_completed':
          updates.status = 'Accepted';
          updates.accepted_at = now;
          
          // Update project status if linked
          if (quote.project_id) {
            try {
              await base44.asServiceRole.entities.Project.update(quote.project_id, {
                status: 'Quote Approved'
              });
              console.log(`Updated project ${quote.project_id} to Quote Approved`);
            } catch (err) {
              console.error('Failed to update project status:', err);
            }
          }
          break;

        case 'document_declined':
          updates.status = 'Declined';
          updates.declined_at = now;
          break;

        case 'document_voided':
          updates.status = 'Declined';
          updates.declined_at = now;
          break;

        default:
          console.log(`Unhandled PandaDoc event: ${eventType}`);
      }

      // Update value if provided (but respect financial locking)
      const grandTotalAmount = event.data?.grand_total?.amount || event.document?.grand_total?.amount;
      if (grandTotalAmount) {
        const newValue = parseFloat(grandTotalAmount);
        if (!isNaN(newValue)) {
          // Check if project has financial value locked
          if (quote.project_id) {
            const project = await base44.asServiceRole.entities.Project.get(quote.project_id);
            if (!project?.financial_value_locked) {
              updates.value = newValue;
            } else {
              console.log(`Skipped value update for quote ${quote.id} - project financial_value_locked`);
            }
          } else {
            updates.value = newValue;
          }
        }
      }

      // GUARDRAIL: Apply status/value updates only - never touch project_id or job_id links
      if (Object.keys(updates).length > 0) {
        await base44.asServiceRole.entities.Quote.update(quote.id, updates);
        console.log(`Updated quote ${quote.id}:`, updates);
        
        // Update project activity if quote is linked to a project
        if (quote.project_id) {
          const activityType = updates.status === 'Accepted' ? 'Quote Accepted' : 
                               updates.status === 'Declined' ? 'Quote Declined' : 
                               updates.status === 'Viewed' ? 'Quote Viewed' : 
                               'Quote Updated';
          await updateProjectActivity(base44, quote.project_id, activityType);
        }
      }
    }

    return Response.json({ success: true });

  } catch (error) {
    console.error('handlePandaDocWebhook error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});