// Pure function to compute derived attention items from project data
// These are NOT stored, NOT editable, and auto-resolve when conditions change

const NEGATIVE_KEYWORDS = [
  'disappointed',
  'frustrated',
  'unhappy',
  'unacceptable',
  'dissatisfied',
  'complaint',
  'unprofessional',
  'poor service',
  'not happy',
  'very upset',
  'terrible',
  'horrible',
  'awful',
  'disgusted',
  'angry',
  'furious',
  'fed up',
  'sick of',
  'had enough',
  'this is ridiculous',
  'this is unacceptable',
  'extremely poor',
  'very disappointed',
  'very frustrated',
  'still waiting',
  'no response',
  'why hasn\'t',
  'ridiculous',
  'please explain',
  'call me immediately'
];

function detectNegativeSentiment(emails) {
  if (!emails || !Array.isArray(emails) || emails.length === 0) {
    return null;
  }

  // Filter inbound client emails only
  const inboundEmails = emails
    .filter(email => !email.is_outbound)
    .sort((a, b) => new Date(b.sent_at || b.created_at || 0) - new Date(a.sent_at || a.created_at || 0));

  for (const email of inboundEmails) {
    const content = ((email.body_text || email.content || '').toLowerCase());
    
    for (const keyword of NEGATIVE_KEYWORDS) {
      if (content.includes(keyword)) {
        return {
          timestamp: email.sent_at || email.created_at,
          matched_keyword: keyword,
          email_id: email.id
        };
      }
    }
  }

  return null;
}

function daysSince(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function hoursSince(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  return Math.floor(diff / (1000 * 60 * 60));
}

export function computeAttentionItems({
  project,
  quotes = [],
  invoices = [],
  jobs = [],
  parts = [],
  purchaseOrders = [],
  emails = [],
  manualLogs = [],
  tradeRequirements = []
}) {
  const items = [];
  
  if (!project) return items;

  const now = new Date();

  // RULE 0 — Client not confirmed but job scheduled within 24 hours (CRITICAL, Ops)
  if (!project.client_confirmed) {
    const upcomingJobs = jobs.filter(job => {
      if (!job.scheduled_date || job.status === 'Completed' || job.status === 'Cancelled') {
        return false;
      }
      
      const scheduledDateTime = new Date(job.scheduled_date);
      const hoursUntil = (scheduledDateTime - now) / (1000 * 60 * 60);
      
      return hoursUntil >= 0 && hoursUntil <= 24;
    });

    if (upcomingJobs.length > 0) {
      const earliestJob = upcomingJobs.sort((a, b) => 
        new Date(a.scheduled_date) - new Date(b.scheduled_date)
      )[0];
      
      const hoursUntil = Math.round((new Date(earliestJob.scheduled_date) - now) / (1000 * 60 * 60));
      
      items.push({
        id: 'CLIENT_NOT_CONFIRMED_UPCOMING_JOB',
        reasonCode: 'CLIENT_NOT_CONFIRMED_UPCOMING_JOB',
        priority: 'CRITICAL',
        category: 'Ops',
        message: `Client not confirmed - job in ${hoursUntil}h`,
        deepLinkTab: 'overview'
      });
    }
  }

  // RULE A — Deposit missing after quote accepted (HIGH, Finance)
  const acceptedQuotes = quotes.filter(q => q.status === 'Accepted' || q.status === 'accepted');
  if (acceptedQuotes.length > 0) {
    // Check if any deposit payment exists in project.payments
    const hasDepositInPayments = (project.payments || []).some(p => 
      p.payment_status === 'Paid' && 
      (p.payment_name || '').toLowerCase().includes('deposit')
    );
    
    // Check if deposit is paid in invoices (amount_paid > 0)
    const hasDepositInInvoices = invoices.some(inv => 
      inv.amount_paid > 0
    );
    
    if (!hasDepositInPayments && !hasDepositInInvoices) {
      items.push({
        id: 'DEPOSIT_MISSING_AFTER_ACCEPTED_QUOTE',
        reasonCode: 'DEPOSIT_MISSING_AFTER_ACCEPTED_QUOTE',
        priority: 'HIGH',
        category: 'Finance',
        message: 'Deposit not received (quote accepted)',
        deepLinkTab: 'invoices'
      });
    }
  }

  // RULE B — Invoice overdue (HIGH / MEDIUM, Finance)
  for (const invoice of invoices) {
    if (invoice.status !== 'PAID' && invoice.due_date) {
      const dueDate = new Date(invoice.due_date);
      if (dueDate < now) {
        const daysOverdue = daysSince(invoice.due_date);
        const priority = daysOverdue > 7 ? 'HIGH' : 'MEDIUM';
        
        items.push({
          id: `INVOICE_OVERDUE_${invoice.id}`,
          reasonCode: 'INVOICE_OVERDUE',
          priority,
          category: 'Finance',
          message: `Invoice overdue (${daysOverdue} days)`,
          deepLinkTab: 'invoices',
          sortWeight: daysOverdue // For sorting
        });
      }
    }
  }

  // RULE C — Install scheduled but parts not ready (HIGH, Ops)
  const futureInstallJobs = jobs.filter(job => {
    const isInstall = (job.job_type_name || job.job_type || '').toLowerCase().includes('install');
    const isFuture = job.scheduled_date && new Date(job.scheduled_date) > now;
    const notCompleted = job.status !== 'Completed' && job.status !== 'Cancelled';
    return isInstall && isFuture && notCompleted;
  });

  if (futureInstallJobs.length > 0) {
    // CRITICAL: Parts are ready if they have these statuses
    const readyStatuses = ['received', 'in_vehicle', 'in_storage', 'in_loading_bay', 'reserved', 'available', 'installed', 'ready', 'instorage', 'invehicle', 'inloadingbay'];
    
    const notReadyParts = parts.filter(p => {
      const status = (p.status || '').toLowerCase().replace(/[\s_-]/g, '');
      
      // Cancelled and installed are not shortages
      if (status === 'cancelled' || status === 'installed') {
        return false;
      }
      
      // Check linked PO status first (takes precedence)
      if (p.purchase_order_id) {
        const linkedPO = purchaseOrders.find(po => po.id === p.purchase_order_id);
        if (linkedPO) {
          const poStatus = (linkedPO.status || '').toLowerCase().replace(/[\s_-]/g, '');
          if (readyStatuses.includes(linkedPO.status) || readyStatuses.includes(poStatus)) {
            return false;
          }
        }
      }
      
      // Check if status indicates ready
      if (readyStatuses.includes(p.status) || readyStatuses.includes(status)) {
        return false;
      }
      
      // Check if received quantity is available
      const receivedQty = Number(p.received_qty || p.quantity_received || 0);
      if (receivedQty > 0) {
        return false;
      }
      
      // Everything else is not ready
      return true;
    });
    
    if (notReadyParts.length > 0) {
      items.push({
        id: 'INSTALL_SCHEDULED_PARTS_NOT_READY',
        reasonCode: 'INSTALL_SCHEDULED_PARTS_NOT_READY',
        priority: 'HIGH',
        category: 'Ops',
        message: 'Install scheduled but parts not ready',
        deepLinkTab: 'parts'
      });
    }
  }

  // RULE D — Install project missing requirements (HIGH, Requirements)
  const installTypes = ['Garage Door Install', 'Gate Install', 'Roller Shutter Install', 'Multiple'];
  if (installTypes.includes(project.project_type)) {
    // Check for missing measurements
    const hasMeasurements = project.doors && project.doors.length > 0 && 
      project.doors.some(d => d.height && d.width);
    
    if (!hasMeasurements) {
      items.push({
        id: 'INSTALL_REQUIREMENTS_MEASUREMENTS',
        reasonCode: 'INSTALL_REQUIREMENTS_INCOMPLETE',
        priority: 'HIGH',
        category: 'Requirements',
        message: 'Requirements missing: measurements',
        deepLinkTab: 'requirements'
      });
    }

    // Check for missing door information
    const hasDoorInfo = project.doors && project.doors.length > 0 && 
      project.doors.some(d => d.type || d.style);
    
    if (!hasDoorInfo) {
      items.push({
        id: 'INSTALL_REQUIREMENTS_DOOR_INFO',
        reasonCode: 'INSTALL_REQUIREMENTS_INCOMPLETE',
        priority: 'HIGH',
        category: 'Requirements',
        message: 'Requirements missing: door information',
        deepLinkTab: 'requirements'
      });
    }
  }

  // RULE D2 — Required third-party trade not booked (HIGH, Requirements)
  const unbookedRequiredTrades = tradeRequirements.filter(t => 
    t.is_required && !t.is_booked
  );
  
  if (unbookedRequiredTrades.length > 0) {
    items.push({
      id: 'THIRD_PARTY_TRADE_NOT_BOOKED',
      reasonCode: 'THIRD_PARTY_TRADE_NOT_BOOKED',
      priority: 'HIGH',
      category: 'Requirements',
      message: `Third-party trade not booked (${unbookedRequiredTrades.length})`,
      deepLinkTab: 'requirements'
    });
  }

  // RULE E — Visit overdue and not completed (MEDIUM, Ops)
  for (const job of jobs) {
    if (job.scheduled_date && job.status !== 'Completed' && job.status !== 'Cancelled') {
      const scheduledDateTime = new Date(job.scheduled_date);
      if (scheduledDateTime < now) {
        const daysOverdue = daysSince(job.scheduled_date);
        items.push({
          id: `VISIT_OVERDUE_${job.id}`,
          reasonCode: 'VISIT_OVERDUE_NOT_COMPLETED',
          priority: 'MEDIUM',
          category: 'Ops',
          message: `Visit overdue: not marked completed`,
          deepLinkTab: 'requirements',
          sortWeight: daysOverdue
        });
      }
    }
  }

  // RULE F — Purchase Order ETA missed (MEDIUM, Ops)
  for (const po of purchaseOrders) {
    if (po.eta_date && po.status !== 'received' && po.status !== 'completed') {
      const etaDate = new Date(po.eta_date);
      if (etaDate < now) {
        const reference = po.po_number || po.supplier_name || 'Unknown';
        items.push({
          id: `PO_ETA_MISSED_${po.id}`,
          reasonCode: 'PO_ETA_MISSED',
          priority: 'MEDIUM',
          category: 'Ops',
          message: `PO ETA missed: ${reference}`,
          deepLinkTab: 'parts',
          sortWeight: daysSince(po.eta_date)
        });
      }
    }
  }

  // RULE G — Client email awaiting response (MEDIUM, Comms)
  const inboundEmails = emails.filter(e => !e.is_outbound);
  if (inboundEmails.length > 0) {
    // Sort by most recent
    const sortedInbound = [...inboundEmails].sort((a, b) => 
      new Date(b.sent_at || b.created_at || 0) - new Date(a.sent_at || a.created_at || 0)
    );
    
    const latestInbound = sortedInbound[0];
    const latestInboundTime = new Date(latestInbound.sent_at || latestInbound.created_at);
    
    // Check for any outbound after it
    const hasReplyAfter = emails.some(e => 
      e.is_outbound && 
      new Date(e.sent_at || e.created_at || 0) > latestInboundTime
    );
    
    // Check for manual logs after it
    const hasManualLogAfter = manualLogs.some(log => 
      new Date(log.created_date || log.created_at || 0) > latestInboundTime
    );
    
    const hoursSince = (now - latestInboundTime) / (1000 * 60 * 60);
    
    if (!hasReplyAfter && !hasManualLogAfter && hoursSince > 48) {
      items.push({
        id: 'CLIENT_EMAIL_AWAITING_RESPONSE',
        reasonCode: 'CLIENT_EMAIL_AWAITING_RESPONSE',
        priority: 'MEDIUM',
        category: 'Comms',
        message: 'Client email awaiting response',
        deepLinkTab: 'activity',
        sortWeight: Math.floor(hoursSince / 24) // Days
      });
    }
  }

  // RULE H — Negative client sentiment detected (MEDIUM → HIGH, Comms)
  const negativeSentiment = detectNegativeSentiment(emails);
  if (negativeSentiment) {
    const sentimentTime = new Date(negativeSentiment.timestamp);
    
    // Check for any outbound after it
    const hasReplyAfter = emails.some(e => 
      e.is_outbound && 
      new Date(e.sent_at || e.created_at || 0) > sentimentTime
    );
    
    // Check for manual logs after it
    const hasManualLogAfter = manualLogs.some(log => 
      new Date(log.created_date || log.created_at || 0) > sentimentTime
    );
    
    if (!hasReplyAfter && !hasManualLogAfter) {
      // Check for priority escalation conditions
      const hasInvoiceOverdue = items.some(i => i.reasonCode === 'INVOICE_OVERDUE');
      const hasVisitOverdue = items.some(i => i.reasonCode === 'VISIT_OVERDUE_NOT_COMPLETED');
      const hasDepositMissing = items.some(i => i.reasonCode === 'DEPOSIT_MISSING_AFTER_ACCEPTED_QUOTE');
      
      const shouldEscalate = hasInvoiceOverdue || hasVisitOverdue || hasDepositMissing;
      
      items.push({
        id: 'NEGATIVE_CLIENT_SENTIMENT',
        reasonCode: 'NEGATIVE_CLIENT_SENTIMENT',
        priority: shouldEscalate ? 'HIGH' : 'MEDIUM',
        category: 'Comms',
        message: 'Client frustration detected — follow up required',
        deepLinkTab: 'activity'
      });
    }
  }

  // De-duplicate by reasonCode (keep highest priority)
  const deduped = [];
  const seen = new Map();
  
  for (const item of items) {
    const existing = seen.get(item.reasonCode);
    if (!existing || item.priority === 'CRITICAL' || (item.priority === 'HIGH' && existing.priority !== 'CRITICAL')) {
      seen.set(item.reasonCode, item);
    }
  }
  
  deduped.push(...seen.values());

  // Sort: CRITICAL first, HIGH second, then MEDIUM, then by sortWeight (most urgent first)
  deduped.sort((a, b) => {
    const priorityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
    const aPrio = priorityOrder[a.priority] || 999;
    const bPrio = priorityOrder[b.priority] || 999;
    
    if (aPrio !== bPrio) {
      return aPrio - bPrio;
    }
    return (b.sortWeight || 0) - (a.sortWeight || 0);
  });

  // Limit to 6 items
  return deduped.slice(0, 6);
}