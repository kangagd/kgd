import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all customers
    const customers = await base44.asServiceRole.entities.Customer.list();
    
    let revertedCount = 0;

    for (const customer of customers) {
      let needsRevert = false;
      const updates = {};

      // Check if address_full is just "Australia" (or variations)
      if (customer.address_full === 'Australia' || 
          customer.address_full === 'australia' ||
          customer.address_full === ', Australia') {
        updates.address_full = null;
        needsRevert = true;
      }

      // Check if normalized_address is just "australia" (or variations)
      if (customer.normalized_address === 'australia' || 
          customer.normalized_address === ', australia' ||
          customer.normalized_address === 'australia,') {
        updates.normalized_address = '';
        needsRevert = true;
      }

      if (needsRevert) {
        await base44.asServiceRole.entities.Customer.update(customer.id, updates);
        revertedCount++;
        console.log(`Reverted customer ${customer.id} - ${customer.name}`);
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return Response.json({
      success: true,
      reverted: revertedCount,
      message: `Successfully reverted ${revertedCount} customers with "Australia" only addresses`
    });

  } catch (error) {
    console.error('Error reverting addresses:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});