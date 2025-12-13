import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Import rules - we'll inline them since Deno doesn't support @ imports in functions
const ATTENTION_AUTO_RESOLVE_RULES = [
  {
    id: "payment_invoice_paid",
    applies_to: "Payments",
    resolve_when: (item, context) => {
      const { invoice } = context;
      if (!invoice) return false;
      return (
        invoice.status === "PAID" || 
        invoice.status === "AUTHORISED" ||
        (invoice.amount_due !== undefined && invoice.amount_due <= 0)
      );
    },
    resolution_note_template: "Auto-resolved: invoice paid."
  },
  {
    id: "customer_risk_resolved_comms",
    applies_to: "Customer Risk",
    resolve_when: (item, context) => {
      const { entity, recentComms } = context;
      const isCompleted = entity.status === "Completed";
      
      const hasResolutionConfirmation = recentComms?.some(comm => {
        const text = (comm.message || comm.content || "").toLowerCase();
        return (
          text.includes("all good now") || text.includes("thanks resolved") ||
          text.includes("no worries now") || text.includes("sorted now") ||
          text.includes("fixed now") || text.includes("problem solved") ||
          text.includes("all sorted")
        );
      });
      
      if (isCompleted) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const hasRecentNegativeComms = recentComms?.some(comm => {
          const commDate = new Date(comm.created_at || comm.created_date);
          if (commDate < sevenDaysAgo) return false;
          
          const text = (comm.message || comm.content || "").toLowerCase();
          return (
            text.includes("frustrated") || text.includes("angry") ||
            text.includes("complaint") || text.includes("unacceptable") ||
            text.includes("disappointed")
          );
        });
        
        if (!hasRecentNegativeComms) return true;
      }
      
      return hasResolutionConfirmation;
    },
    resolution_note_template: "Auto-resolved: issue marked resolved by new communication/completion."
  },
  {
    id: "access_site_completed",
    applies_to: "Access & Site",
    resolve_when: (item, context) => {
      const { entity } = context;
      if (entity.status === "Completed") return true;
      
      const notes = (entity.notes || "").toLowerCase();
      const additionalInfo = (entity.additional_info || "").toLowerCase();
      const overview = (entity.overview || "").toLowerCase();
      
      return (
        notes.includes("access sorted") || notes.includes("key provided") ||
        notes.includes("code provided") || notes.includes("no longer need") ||
        additionalInfo.includes("access sorted") || additionalInfo.includes("key provided") ||
        overview.includes("access resolved")
      );
    },
    resolution_note_template: "Auto-resolved: job completed / access requirement no longer applicable."
  },
  {
    id: "hard_blocker_cleared",
    applies_to: "Hard Blocker",
    resolve_when: (item, context) => {
      const { entity } = context;
      
      const notes = (entity.notes || "").toLowerCase();
      const additionalInfo = (entity.additional_info || "").toLowerCase();
      const overview = (entity.overview || "").toLowerCase();
      const nextSteps = (entity.next_steps || "").toLowerCase();
      const outcome = (entity.outcome || "").toLowerCase();
      
      return (
        notes.includes("structure complete") || notes.includes("noggins installed") ||
        notes.includes("framing done") || notes.includes("blocker cleared") ||
        notes.includes("ready to proceed") || additionalInfo.includes("structure complete") ||
        additionalInfo.includes("noggins installed") || overview.includes("blocker cleared") ||
        nextSteps.includes("blocker resolved") || outcome.includes("blocker cleared")
      );
    },
    resolution_note_template: "Auto-resolved: blocker cleared."
  }
];

function getRulesForCategory(category) {
  return ATTENTION_AUTO_RESOLVE_RULES.filter(rule => rule.applies_to === category);
}

function shouldAutoResolve(item, context) {
  const rules = getRulesForCategory(item.category);
  
  for (const rule of rules) {
    try {
      if (rule.resolve_when(item, context)) {
        return {
          shouldResolve: true,
          rule,
          resolutionNote: rule.resolution_note_template
        };
      }
    } catch (error) {
      console.error(`Error checking rule ${rule.id}:`, error);
    }
  }
  
  return { shouldResolve: false };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { entity_type, entity_id, event_type, changed_fields } = await req.json();

    if (!entity_type || !entity_id) {
      return Response.json({ error: 'entity_type and entity_id required' }, { status: 400 });
    }

    // STEP 1: Fetch open attention items for this entity
    const openItems = await base44.asServiceRole.entities.AttentionItem.filter({
      entity_type,
      entity_id,
      status: 'open'
    });

    if (!openItems || openItems.length === 0) {
      return Response.json({ 
        success: true, 
        resolved_count: 0, 
        message: 'No open items to check' 
      });
    }

    // STEP 2: Load minimal entity context
    let entity;
    if (entity_type === 'job') {
      entity = await base44.asServiceRole.entities.Job.get(entity_id);
    } else if (entity_type === 'project') {
      entity = await base44.asServiceRole.entities.Project.get(entity_id);
    } else {
      return Response.json({ error: 'Invalid entity_type' }, { status: 400 });
    }

    // Load related invoice if exists
    let invoice = null;
    if (entity.xero_invoice_id) {
      try {
        invoice = await base44.asServiceRole.entities.XeroInvoice.get(entity.xero_invoice_id);
      } catch (e) {
        // No invoice or error loading
      }
    } else if (entity.primary_xero_invoice_id) {
      try {
        invoice = await base44.asServiceRole.entities.XeroInvoice.get(entity.primary_xero_invoice_id);
      } catch (e) {
        // No invoice or error loading
      }
    }

    // Load recent communications (last 10)
    let recentComms = [];
    try {
      if (entity_type === 'job') {
        recentComms = await base44.asServiceRole.entities.JobMessage.filter(
          { job_id: entity_id },
          '-created_at',
          10
        );
      } else if (entity_type === 'project') {
        recentComms = await base44.asServiceRole.entities.ProjectMessage.filter(
          { project_id: entity_id },
          '-created_at',
          10
        );
      }
    } catch (e) {
      recentComms = [];
    }

    const context = {
      entity,
      invoice,
      recentComms,
      event_type,
      changed_fields
    };

    // STEP 3: Check each open item against rules
    const resolvedItems = [];
    const skippedItems = [];

    for (const item of openItems) {
      const result = shouldAutoResolve(item, context);
      
      if (result.shouldResolve) {
        try {
          await base44.asServiceRole.entities.AttentionItem.update(item.id, {
            status: 'resolved',
            resolved_by_name: 'System',
            resolved_at: new Date().toISOString(),
            resolution_note: result.resolutionNote
          });
          
          resolvedItems.push({
            id: item.id,
            title: item.title,
            rule: result.rule.id,
            resolution_note: result.resolutionNote
          });
        } catch (e) {
          console.error(`Error resolving item ${item.id}:`, e);
          skippedItems.push(item.id);
        }
      } else {
        skippedItems.push(item.id);
      }
    }

    return Response.json({
      success: true,
      resolved_count: resolvedItems.length,
      skipped_count: skippedItems.length,
      resolved_items: resolvedItems
    });

  } catch (error) {
    console.error('Error auto-resolving attention items:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});