import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { event, data, old_data } = body;

    // Only trigger on update events
    if (event.type !== 'update') {
      return Response.json({ success: true, skipped: true });
    }

    // Check if status changed to PAID
    const statusChangedToPaid = old_data?.status !== 'PAID' && data?.status === 'PAID';
    
    if (!statusChangedToPaid) {
      return Response.json({ success: true, skipped: true });
    }

    // Get all admin users
    const adminUsers = await base44.asServiceRole.entities.User.filter({ role: 'admin' });

    if (adminUsers.length === 0) {
      return Response.json({ success: true, notified: 0 });
    }

    // Send notification to each admin
    const invoiceNumber = data.xero_invoice_number || data.reference || 'Invoice';
    const customerName = data.customer_name || 'Unknown Customer';
    const amount = data.total || 0;

    const notifications = await Promise.all(
      adminUsers.map(admin =>
        base44.asServiceRole.entities.Notification.create({
          user_email: admin.email,
          user_id: admin.id,
          title: `Invoice Paid: ${invoiceNumber}`,
          body: `Payment received from ${customerName} for $${amount.toFixed(2)}`,
          type: 'success',
          related_entity_type: 'XeroInvoice',
          related_entity_id: data.id,
          is_read: false
        })
      )
    );

    return Response.json({ 
      success: true, 
      notified: notifications.length 
    });
  } catch (error) {
    console.error('Error notifying admin of paid invoice:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});