import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return Response.json({ error: 'Forbidden: Admin or Manager access required' }, { status: 403 });
    }

    const { customerId, customer_id, data } = await req.json();
    const finalCustomerId = customerId || customer_id;

    if (!finalCustomerId) {
      return Response.json({ error: 'customerId is required' }, { status: 400 });
    }

    // Build update object with normalization
    const updates = { ...data };

    // Normalize fields
    if (updates.phone !== undefined) {
      updates.normalized_phone = updates.phone ? updates.phone.replace(/\D/g, '') : '';
    }

    if (updates.email !== undefined) {
      updates.normalized_email = updates.email ? updates.email.toLowerCase().trim() : '';
    }

    if (updates.name !== undefined) {
      updates.normalized_name = updates.name ? updates.name.toLowerCase().trim() : '';
    }

    // Check for duplicates before updating
    const duplicateQuery = [];
    
    if (updates.normalized_email) {
      duplicateQuery.push({ normalized_email: updates.normalized_email });
    }
    if (updates.normalized_phone) {
      duplicateQuery.push({ normalized_phone: updates.normalized_phone });
    }

    if (duplicateQuery.length > 0) {
      const existingCustomers = await base44.asServiceRole.entities.Customer.filter({
        $or: duplicateQuery,
        id: { $ne: finalCustomerId }
      });

      if (existingCustomers.length > 0) {
        return Response.json({ 
          error: 'A customer with this email or phone already exists',
          duplicates: existingCustomers.map(c => ({ id: c.id, name: c.name, email: c.email, phone: c.phone }))
        }, { status: 409 });
      }
    }

    // Update the customer
    const updatedCustomer = await base44.asServiceRole.entities.Customer.update(finalCustomerId, updates);

    // Update all related projects with new customer info
    const projects = await base44.asServiceRole.entities.Project.filter({ customer_id: finalCustomerId });
    
    for (const project of projects) {
      const projectUpdates = {};
      if (updates.name !== undefined) projectUpdates.customer_name = updates.name;
      if (updates.phone !== undefined) projectUpdates.customer_phone = updates.phone;
      if (updates.email !== undefined) projectUpdates.customer_email = updates.email;
      
      if (Object.keys(projectUpdates).length > 0) {
        await base44.asServiceRole.entities.Project.update(project.id, projectUpdates);
      }
    }

    // Update all related jobs with new customer info
    const jobs = await base44.asServiceRole.entities.Job.filter({ customer_id: finalCustomerId });
    
    for (const job of jobs) {
      const jobUpdates = {};
      if (updates.name !== undefined) jobUpdates.customer_name = updates.name;
      if (updates.phone !== undefined) jobUpdates.customer_phone = updates.phone;
      if (updates.email !== undefined) jobUpdates.customer_email = updates.email;
      
      if (Object.keys(jobUpdates).length > 0) {
        await base44.asServiceRole.entities.Job.update(job.id, jobUpdates);
      }
    }

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