import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { quote_id, custom_message } = await req.json();

    if (!quote_id) {
      return Response.json({ error: 'Quote ID required' }, { status: 400 });
    }

    // Get quote
    const quotes = await base44.entities.Quote.filter({ id: quote_id });
    if (quotes.length === 0) {
      return Response.json({ error: 'Quote not found' }, { status: 404 });
    }

    const quote = quotes[0];

    if (!quote.customer_email) {
      return Response.json({ error: 'Customer email not set' }, { status: 400 });
    }

    // Generate public share token if not exists
    let shareToken = quote.public_share_token;
    if (!shareToken) {
      shareToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
      await base44.entities.Quote.update(quote_id, { public_share_token: shareToken });
    }

    // Build public quote URL
    const quoteUrl = `https://app.base44.com/apps/kangaroo-garage-doors/public-quote?token=${shareToken}`;

    // Build email content
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #111827;">Quote from Kangaroo Garage Doors</h2>
        
        <p>Hi ${quote.customer_name},</p>
        
        ${custom_message ? `<p>${custom_message}</p>` : ''}
        
        <p>Please find your quote <strong>${quote.quote_number}</strong> for "${quote.title}".</p>
        
        <div style="background: #F9FAFB; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Quote Total:</strong> $${quote.total_amount?.toFixed(2) || '0.00'} ${quote.currency || 'AUD'}</p>
          ${quote.expires_at ? `<p style="margin: 0; color: #6B7280;"><strong>Valid until:</strong> ${new Date(quote.expires_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>` : ''}
        </div>
        
        <p>
          <a href="${quoteUrl}" style="display: inline-block; background: #FAE008; color: #111827; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
            View Quote
          </a>
        </p>
        
        <p style="color: #6B7280; font-size: 14px; margin-top: 30px;">
          If you have any questions, please don't hesitate to contact us.
        </p>
        
        <p style="color: #6B7280; font-size: 14px;">
          Regards,<br>
          Kangaroo Garage Doors
        </p>
      </div>
    `;

    // Send email using Core integration
    await base44.integrations.Core.SendEmail({
      to: quote.customer_email,
      subject: `Quote ${quote.quote_number}: ${quote.title}`,
      body: emailBody
    });

    // Update quote status to Sent
    await base44.entities.Quote.update(quote_id, {
      status: 'Sent',
      sent_at: new Date().toISOString()
    });

    return Response.json({ 
      success: true, 
      message: 'Quote sent successfully',
      quote_url: quoteUrl
    });

  } catch (error) {
    console.error('Send quote email error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});