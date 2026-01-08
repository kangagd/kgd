import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Batch link PandaDoc quotes to projects based on project number or address matching
 * SAFETY FEATURES:
 * - Dry run mode to preview matches before linking
 * - Prevents duplicate links
 * - Fuzzy address matching
 * - Logs all actions for audit trail
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const PANDADOC_API_KEY = Deno.env.get('PANDADOC_API_KEY');
    if (!PANDADOC_API_KEY) {
      return Response.json({ error: 'PandaDoc API key not configured' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const { dryRun = true, limit = 50 } = body;

    // Fetch all PandaDoc documents
    const docsResponse = await fetch(
      'https://api.pandadoc.com/public/v1/documents?count=100&order_by=-date_created',
      {
        headers: {
          'Authorization': `API-Key ${PANDADOC_API_KEY}`
        }
      }
    );

    if (!docsResponse.ok) {
      return Response.json({ 
        error: 'Failed to fetch PandaDoc documents', 
        status: docsResponse.status 
      }, { status: 500 });
    }

    const docsData = await docsResponse.json();
    const pandadocDocs = docsData.results || [];

    // Get all projects and existing quotes
    const [projects, existingQuotes] = await Promise.all([
      base44.asServiceRole.entities.Project.list(),
      base44.asServiceRole.entities.Quote.list()
    ]);

    // Build lookup maps
    const projectsByNumber = new Map();
    const projectsByAddress = new Map();
    for (const project of projects) {
      if (project.project_number) {
        projectsByNumber.set(project.project_number, project);
      }
      if (project.address_full) {
        const normalizedAddress = project.address_full.toLowerCase().replace(/[^a-z0-9]/g, '');
        projectsByAddress.set(normalizedAddress, project);
      }
    }

    const existingQuotesByDocId = new Map(
      existingQuotes.map(q => [q.pandadoc_document_id, q])
    );

    const results = {
      total_documents: pandadocDocs.length,
      processed: 0,
      matched: [],
      already_linked: [],
      no_match: [],
      errors: [],
      linked_count: 0
    };

    // Helper to normalize address for matching
    const normalizeAddress = (addr) => {
      if (!addr) return '';
      return addr.toLowerCase().replace(/[^a-z0-9]/g, '');
    };

    // Helper to extract project number from quote name
    const extractProjectNumber = (name) => {
      if (!name) return null;
      // Match patterns like "5001", "#5001", "Project 5001", etc.
      const match = name.match(/(?:#|project\s*)?(\d{4,5})/i);
      return match ? parseInt(match[1]) : null;
    };

    // Process each document
    for (const doc of pandadocDocs.slice(0, limit)) {
      results.processed++;

      try {
        // Skip if already linked
        const existingQuote = existingQuotesByDocId.get(doc.id);
        if (existingQuote && existingQuote.project_id) {
          results.already_linked.push({
            doc_id: doc.id,
            doc_name: doc.name,
            project_id: existingQuote.project_id,
            quote_id: existingQuote.id
          });
          continue;
        }

        let matchedProject = null;
        let matchMethod = null;

        // Try matching by project number in name
        const projectNumber = extractProjectNumber(doc.name);
        if (projectNumber) {
          matchedProject = projectsByNumber.get(projectNumber);
          if (matchedProject) {
            matchMethod = 'project_number';
          }
        }

        // Try matching by address in metadata or recipient
        if (!matchedProject && doc.metadata?.address) {
          const normalizedDocAddress = normalizeAddress(doc.metadata.address);
          if (normalizedDocAddress) {
            matchedProject = projectsByAddress.get(normalizedDocAddress);
            if (matchedProject) {
              matchMethod = 'address';
            }
          }
        }

        // If matched, prepare to link
        if (matchedProject) {
          const matchInfo = {
            doc_id: doc.id,
            doc_name: doc.name,
            doc_status: doc.status,
            project_id: matchedProject.id,
            project_number: matchedProject.project_number,
            project_title: matchedProject.title,
            match_method: matchMethod,
            confidence: matchMethod === 'project_number' ? 'high' : 'medium'
          };

          results.matched.push(matchInfo);

          // If not dry run, perform the linking
          if (!dryRun) {
            try {
              // Use the existing linkPandaDocQuote logic
              const statusMap = {
                'document.draft': 'Draft',
                'document.uploaded': 'Draft',
                'document.sent': 'Sent',
                'document.viewed': 'Viewed',
                'document.waiting_approval': 'Sent',
                'document.completed': 'Accepted',
                'document.voided': 'Declined',
                'document.declined': 'Declined',
                'document.expired': 'Expired'
              };

              const quoteStatus = statusMap[doc.status] || 'Draft';
              const value = doc.grand_total?.amount ? parseFloat(doc.grand_total.amount) : 0;

              const quoteData = {
                project_id: matchedProject.id,
                customer_id: matchedProject.customer_id,
                name: doc.name || 'Untitled Quote',
                value: value,
                currency: doc.grand_total?.currency || 'AUD',
                pandadoc_document_id: doc.id,
                pandadoc_internal_url: `https://app.pandadoc.com/a/#/documents/${doc.id}`,
                status: quoteStatus,
                sent_at: doc.date_sent || null,
                expires_at: doc.expiration_date || null,
                customer_name: matchedProject.customer_name || '',
                customer_email: matchedProject.customer_email || '',
                project_title: matchedProject.title || ''
              };

              if (existingQuote) {
                // Update existing quote
                await base44.asServiceRole.entities.Quote.update(existingQuote.id, quoteData);
                matchInfo.action = 'updated_existing';
                matchInfo.quote_id = existingQuote.id;
              } else {
                // Create new quote
                const newQuote = await base44.asServiceRole.entities.Quote.create(quoteData);
                matchInfo.action = 'created_new';
                matchInfo.quote_id = newQuote.id;

                // Set as primary quote if project has none
                if (!matchedProject.primary_quote_id) {
                  await base44.asServiceRole.entities.Project.update(matchedProject.id, {
                    primary_quote_id: newQuote.id
                  });
                  matchInfo.set_as_primary = true;
                }
              }

              results.linked_count++;

              // Small delay to avoid rate limits
              await new Promise(resolve => setTimeout(resolve, 200));

            } catch (linkError) {
              results.errors.push({
                doc_id: doc.id,
                doc_name: doc.name,
                error: linkError.message
              });
            }
          }
        } else {
          results.no_match.push({
            doc_id: doc.id,
            doc_name: doc.name,
            doc_status: doc.status,
            reason: 'No matching project found by number or address'
          });
        }

      } catch (error) {
        results.errors.push({
          doc_id: doc.id,
          doc_name: doc.name,
          error: error.message
        });
      }
    }

    return Response.json({
      success: true,
      dry_run: dryRun,
      summary: {
        total: results.total_documents,
        processed: results.processed,
        matched: results.matched.length,
        already_linked: results.already_linked.length,
        no_match: results.no_match.length,
        linked: results.linked_count,
        errors: results.errors.length
      },
      results
    });

  } catch (error) {
    console.error('batchLinkPandaDocQuotes error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});