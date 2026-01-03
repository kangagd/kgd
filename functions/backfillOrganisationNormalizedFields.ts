import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Normalization helpers
function normalizeString(str) {
  if (!str) return '';
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

function normalizePhone(phone) {
  if (!phone) return '';
  return phone.replace(/[\s\+\(\)\-\.]/g, '');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('Fetching all organisations...');
    const allOrganisations = await base44.asServiceRole.entities.Organisation.list();
    
    let updated = 0;
    let skipped = 0;

    console.log(`Processing ${allOrganisations.length} organisations...`);

    for (const org of allOrganisations) {
      // Skip deleted organisations
      if (org.deleted_at) {
        skipped++;
        continue;
      }

      const normalizedName = normalizeString(org.name);
      const normalizedEmail = org.email ? org.email.toLowerCase().trim() : null;
      const normalizedPhone = normalizePhone(org.phone);

      // Check if we need to update
      const needsUpdate = 
        org.normalized_name !== normalizedName ||
        org.normalized_email !== normalizedEmail ||
        org.normalized_phone !== normalizedPhone;

      if (needsUpdate) {
        await base44.asServiceRole.entities.Organisation.update(org.id, {
          normalized_name: normalizedName,
          normalized_email: normalizedEmail,
          normalized_phone: normalizedPhone
        });
        updated++;
        console.log(`Updated: ${org.name} (${org.id})`);
      } else {
        skipped++;
      }
    }

    console.log(`Backfill complete: ${updated} updated, ${skipped} skipped`);

    return Response.json({
      success: true,
      total: allOrganisations.length,
      updated,
      skipped
    });

  } catch (error) {
    console.error('Backfill error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});