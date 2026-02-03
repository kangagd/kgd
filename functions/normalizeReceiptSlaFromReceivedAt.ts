import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Admin authorization
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all open receipts
    const receipts = await base44.asServiceRole.entities.Receipt.filter({ status: 'open' });
    
    let checked = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const receipt of receipts) {
      checked++;

      if (!receipt.received_at) {
        skipped++;
        continue;
      }

      const receivedAt = new Date(receipt.received_at);
      if (isNaN(receivedAt.getTime())) {
        skipped++;
        continue;
      }

      // Check if normalization is needed
      let needsUpdate = false;

      if (!receipt.sla_clock_start_at) {
        needsUpdate = true;
      } else {
        const clockStartAt = new Date(receipt.sla_clock_start_at);
        if (isNaN(clockStartAt.getTime())) {
          needsUpdate = true;
        } else {
          // Check if difference is more than 60 minutes
          const diffMinutes = Math.abs((clockStartAt.getTime() - receivedAt.getTime()) / 60000);
          if (diffMinutes > 60) {
            needsUpdate = true;
          }
        }
      }

      if (!needsUpdate) {
        skipped++;
        continue;
      }

      // Update receipt: normalize SLA clock to received_at
      try {
        const slaDueAt = new Date(receivedAt.getTime() + 48 * 3600 * 1000);
        
        await base44.asServiceRole.entities.Receipt.update(receipt.id, {
          sla_clock_start_at: receivedAt.toISOString(),
          sla_due_at: slaDueAt.toISOString()
        });

        updated++;
        console.log(`[normalizeReceipt] Updated receipt ${receipt.id}: sla_clock_start_at set to received_at`);
      } catch (error) {
        failed++;
        console.error(`[normalizeReceipt] Failed to update receipt ${receipt.id}:`, error);
      }
    }

    return Response.json({
      success: true,
      checked,
      updated,
      skipped,
      failed
    });

  } catch (error) {
    console.error('[normalizeReceipt] Error:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});