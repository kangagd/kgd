import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { updateProjectActivity } from './updateProjectActivity.js';

Deno.serve(async (req) => {
  try {
    // PandaDoc webhooks don't require user auth
    const base44 = createClientFromRequest(req);

    const body = await req.json();
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

      // Update value if provided
      const grandTotalAmount = event.data?.grand_total?.amount || event.document?.grand_total?.amount;
      if (grandTotalAmount) {
        const newValue = parseFloat(grandTotalAmount);
        if (!isNaN(newValue)) {
          updates.value = newValue;
        }
      }

      // Apply updates if any
      if (Object.keys(updates).length > 0) {
        await base44.asServiceRole.entities.Quote.update(quote.id, updates);
        console.log(`Updated quote ${quote.id}:`, updates);
        
        // Update project activity if quote is linked to a project
        if (quote.project_id) {
          await updateProjectActivity(base44, quote.project_id);
        }
      }
    }

    return Response.json({ success: true });

  } catch (error) {
    console.error('handlePandaDocWebhook error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});