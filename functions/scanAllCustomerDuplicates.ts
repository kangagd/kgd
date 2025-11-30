import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all active customers
    const customers = await base44.asServiceRole.entities.Customer.filter({
      deleted_at: { $exists: false },
      status: 'active'
    });

    let updatedCount = 0;

    // We can use the checkDuplicates logic here.
    // Instead of calling the function via HTTP (which might timeout if we loop),
    // we can import/duplicate the logic or better, loop and call it.
    // Given time limits, let's loop and invoke the check logic.
    // However, checkDuplicates is a backend function, calling it via HTTP loop is slow.
    // Better to implement logic here directly or import if shared (but Deno deploy doesn't easily share code between function files unless in a shared module - we don't have one set up).
    // So I'll replicate the core logic briefly for efficiency.

    // Helper
    function normalizeString(str) {
        if (!str) return '';
        return str.toLowerCase().trim().replace(/\s+/g, ' ');
    }
    function normalizePhone(phone) {
        if (!phone) return '';
        return phone.replace(/[\s\+\(\)\-\.]/g, '');
    }
    function normalizeAddress(record) {
        const parts = [
            record.address_street,
            record.address_suburb,
            record.address_state,
            record.address_postcode,
            record.address_full,
            record.address
        ].filter(Boolean);
        return normalizeString(parts.join(' '));
    }

    // Pre-normalize all
    const normalizedCustomers = customers.map(c => ({
        ...c,
        normName: normalizeString(c.name),
        normEmail: c.email ? c.email.toLowerCase().trim() : '',
        normPhone: normalizePhone(c.phone),
        normAddr: normalizeAddress(c)
    }));

    for (let i = 0; i < normalizedCustomers.length; i++) {
        const current = normalizedCustomers[i];
        if (current.is_potential_duplicate) continue; // Already flagged, maybe skip or re-check? Let's re-check.

        let score = 0;
        
        for (let j = 0; j < normalizedCustomers.length; j++) {
            if (i === j) continue;
            const other = normalizedCustomers[j];
            
            let matchScore = 0;
            if (current.normName && other.normName && current.normName === other.normName) matchScore++;
            if (current.normEmail && other.normEmail && current.normEmail === other.normEmail) matchScore++;
            if (current.normPhone && other.normPhone && current.normPhone === other.normPhone) matchScore++;
            
            // Address fuzzy matching is hard, let's exact match normalized string
            // Or if one contains the other
            // if (current.normAddr && other.normAddr && current.normAddr === other.normAddr) matchScore++; 

            score = Math.max(score, matchScore);
        }

        if (score > 0 && !current.is_potential_duplicate) {
             await base44.asServiceRole.entities.Customer.update(current.id, {
                 is_potential_duplicate: true,
                 duplicate_score: score
             });
             updatedCount++;
        } else if (score === 0 && current.is_potential_duplicate && current.merge_status !== 'ignored') {
             // Clear flag if no longer duplicate?
             await base44.asServiceRole.entities.Customer.update(current.id, {
                 is_potential_duplicate: false,
                 duplicate_score: 0
             });
             updatedCount++;
        }
    }

    return Response.json({ success: true, updated: updatedCount });

  } catch (error) {
    console.error('Scan error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});