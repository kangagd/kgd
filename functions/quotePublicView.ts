import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    const action = url.searchParams.get('action');

    if (!token) {
      return Response.json({ error: 'Missing token' }, { status: 400 });
    }

    // Find quote by public share token
    const quotes = await base44.asServiceRole.entities.Quote.filter({ public_share_token: token });
    
    if (quotes.length === 0) {
      return Response.json({ error: 'Quote not found' }, { status: 404 });
    }

    const quote = quotes[0];

    // Check if public link is active
    if (!quote.is_public_active) {
      return Response.json({ error: 'This quote link is no longer active' }, { status: 403 });
    }

    // Check if expired
    if (quote.expires_at && new Date(quote.expires_at) < new Date() && quote.status !== 'Accepted' && quote.status !== 'Declined') {
      await base44.asServiceRole.entities.Quote.update(quote.id, { status: 'Expired' });
      quote.status = 'Expired';
    }

    // Get client IP and user agent
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('cf-connecting-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Handle different actions
    if (action === 'view') {
      // Record view event
      await base44.asServiceRole.entities.QuoteViewEvent.create({
        quote_id: quote.id,
        viewed_at: new Date().toISOString(),
        viewer_ip: clientIP,
        user_agent: userAgent,
        referrer: req.headers.get('referer') || ''
      });

      // Update status to Viewed if currently Sent
      if (quote.status === 'Sent') {
        await base44.asServiceRole.entities.Quote.update(quote.id, { status: 'Viewed' });
        quote.status = 'Viewed';
      }

      // Get quote items
      const items = await base44.asServiceRole.entities.QuoteItem.filter({ quote_id: quote.id }, 'sort_order');
      
      // Get option groups
      const groups = await base44.asServiceRole.entities.QuoteOptionGroup.filter({ quote_id: quote.id }, 'sort_order');
      
      // Get attachments
      const attachments = await base44.asServiceRole.entities.QuoteAttachment.filter({ 
        quote_id: quote.id, 
        is_visible_to_customer: true 
      });

      return Response.json({
        quote: {
          id: quote.id,
          quote_number: quote.quote_number,
          title: quote.title,
          public_heading: quote.public_heading,
          public_intro: quote.public_intro,
          customer_name: quote.customer_name,
          address_full: quote.address_full,
          currency: quote.currency,
          subtotal_amount: quote.subtotal_amount,
          discount_amount: quote.discount_amount,
          discount_type: quote.discount_type,
          tax_rate: quote.tax_rate,
          tax_amount: quote.tax_amount,
          total_amount: quote.total_amount,
          expires_at: quote.expires_at,
          status: quote.status,
          terms_and_conditions: quote.terms_and_conditions,
          signed_at: quote.signed_at,
          signed_by_name: quote.signed_by_name
        },
        items,
        groups,
        attachments
      });
    }

    if (action === 'accept') {
      if (quote.status === 'Accepted') {
        return Response.json({ error: 'Quote already accepted' }, { status: 400 });
      }
      if (quote.status === 'Expired') {
        return Response.json({ error: 'Quote has expired' }, { status: 400 });
      }
      if (quote.status === 'Declined') {
        return Response.json({ error: 'Quote was declined' }, { status: 400 });
      }

      const body = await req.json();
      const { signed_by_name, signed_by_email, selected_items } = body;

      if (!signed_by_name || !signed_by_email) {
        return Response.json({ error: 'Name and email required to accept' }, { status: 400 });
      }

      // Update quote
      await base44.asServiceRole.entities.Quote.update(quote.id, {
        status: 'Accepted',
        signed_at: new Date().toISOString(),
        signed_by_name,
        signed_by_email,
        signed_ip_address: clientIP
      });

      // Optionally update selected items if customer made selections
      if (selected_items && Array.isArray(selected_items)) {
        for (const itemId of selected_items) {
          await base44.asServiceRole.entities.QuoteItem.update(itemId, { is_default_selected: true });
        }
      }

      return Response.json({ success: true, message: 'Quote accepted successfully' });
    }

    if (action === 'decline') {
      if (quote.status === 'Accepted') {
        return Response.json({ error: 'Quote already accepted' }, { status: 400 });
      }

      const body = await req.json();
      const { reason } = body;

      await base44.asServiceRole.entities.Quote.update(quote.id, {
        status: 'Declined',
        declined_at: new Date().toISOString(),
        declined_reason: reason || ''
      });

      return Response.json({ success: true, message: 'Quote declined' });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Quote public view error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});