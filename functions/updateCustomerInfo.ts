import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return Response.json({ error: 'Forbidden: Admin or Manager access required' }, { status: 403 });
    }

    const { customer_id, phone, email } = await req.json();

    if (!customer_id) {
      return Response.json({ error: 'customer_id is required' }, { status: 400 });
    }

    // Build update object
    const updates = {};

    if (phone !== undefined) {
      updates.phone = phone;
      updates.normalized_phone = phone ? phone.replace(/\D/g, '') : '';
    }

    if (email !== undefined) {
      updates.email = email;
      updates.normalized_email = email ? email.toLowerCase().trim() : '';
    }

    // Update the customer
    const updatedCustomer = await base44.asServiceRole.entities.Customer.update(customer_id, updates);

    return Response.json({ 
      success: true, 
      customer: updatedCustomer,
      message: 'Customer updated successfully'
    });

  } catch (error) {
    console.error('Error updating customer:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});