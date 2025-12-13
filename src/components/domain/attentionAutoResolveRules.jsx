/**
 * AUTO-RESOLVE RULES FOR ATTENTION ITEMS
 * Deterministic rules that automatically resolve attention items when conditions are met
 */

export const ATTENTION_AUTO_RESOLVE_RULES = [
  {
    id: "payment_invoice_paid",
    applies_to: "Payments",
    description: "Resolve when invoice is paid",
    resolve_when: (item, context) => {
      const { invoice } = context;
      if (!invoice) return false;
      
      // Resolve if invoice is PAID or amount_due is 0 or less
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
    description: "Resolve when customer confirms resolution or job completed without new complaints",
    resolve_when: (item, context) => {
      const { entity, recentComms } = context;
      
      // Check if job/project is completed
      const isCompleted = entity.status === "Completed";
      
      // Check recent communications for resolution keywords
      const hasResolutionConfirmation = recentComms?.some(comm => {
        const text = (comm.message || comm.content || "").toLowerCase();
        return (
          text.includes("all good now") ||
          text.includes("thanks resolved") ||
          text.includes("no worries now") ||
          text.includes("sorted now") ||
          text.includes("fixed now") ||
          text.includes("problem solved") ||
          text.includes("all sorted")
        );
      });
      
      // Check if completed with no negative comms in last 7 days
      if (isCompleted) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const hasRecentNegativeComms = recentComms?.some(comm => {
          const commDate = new Date(comm.created_at || comm.created_date);
          if (commDate < sevenDaysAgo) return false;
          
          const text = (comm.message || comm.content || "").toLowerCase();
          return (
            text.includes("frustrated") ||
            text.includes("angry") ||
            text.includes("complaint") ||
            text.includes("unacceptable") ||
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
    description: "Resolve when access resolved or job completed",
    resolve_when: (item, context) => {
      const { entity } = context;
      
      // Job completed
      if (entity.status === "Completed") return true;
      
      // Check if access instructions were updated to remove requirement
      const notes = (entity.notes || "").toLowerCase();
      const additionalInfo = (entity.additional_info || "").toLowerCase();
      const overview = (entity.overview || "").toLowerCase();
      
      const hasAccessResolution = 
        notes.includes("access sorted") ||
        notes.includes("key provided") ||
        notes.includes("code provided") ||
        notes.includes("no longer need") ||
        additionalInfo.includes("access sorted") ||
        additionalInfo.includes("key provided") ||
        overview.includes("access resolved");
      
      return hasAccessResolution;
    },
    resolution_note_template: "Auto-resolved: job completed / access requirement no longer applicable."
  },

  {
    id: "hard_blocker_cleared",
    applies_to: "Hard Blocker",
    description: "Resolve when blocker explicitly cleared in notes",
    resolve_when: (item, context) => {
      const { entity } = context;
      
      // Check job/project fields for blocker clearance
      const notes = (entity.notes || "").toLowerCase();
      const additionalInfo = (entity.additional_info || "").toLowerCase();
      const overview = (entity.overview || "").toLowerCase();
      const nextSteps = (entity.next_steps || "").toLowerCase();
      const outcome = (entity.outcome || "").toLowerCase();
      
      const blockerCleared = 
        notes.includes("structure complete") ||
        notes.includes("noggins installed") ||
        notes.includes("framing done") ||
        notes.includes("blocker cleared") ||
        notes.includes("ready to proceed") ||
        additionalInfo.includes("structure complete") ||
        additionalInfo.includes("noggins installed") ||
        overview.includes("blocker cleared") ||
        nextSteps.includes("blocker resolved") ||
        outcome.includes("blocker cleared");
      
      return blockerCleared;
    },
    resolution_note_template: "Auto-resolved: blocker cleared."
  }
];

/**
 * Get applicable rules for a given attention item category
 */
export function getRulesForCategory(category) {
  return ATTENTION_AUTO_RESOLVE_RULES.filter(rule => rule.applies_to === category);
}

/**
 * Check if any rule applies and returns true
 */
export function shouldAutoResolve(item, context) {
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