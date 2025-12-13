import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Evaluate and generate attention items for an entity
 * Triggered by: email received, job update, payment change, note added
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entity_type, entity_id } = await req.json();

    if (!entity_type || !entity_id) {
      return Response.json({ error: 'entity_type and entity_id required' }, { status: 400 });
    }

    // 1. Collect context
    const context = await collectContext(base44, entity_type, entity_id);

    // 2. Apply detection heuristics
    const signals = await detectSignals(context);

    // 3. Score and filter
    const items = signals.filter(s => s.score >= 60); // Threshold: 60%

    // 4. Create or update attention items
    const results = [];
    for (const item of items) {
      // Check if similar item already exists
      const existing = await base44.asServiceRole.entities.AttentionItem.filter({
        entity_type,
        entity_id,
        category: item.category,
        status: 'active',
        trigger_id: item.trigger_id
      });

      if (existing.length === 0) {
        const created = await base44.asServiceRole.entities.AttentionItem.create({
          entity_type,
          entity_id,
          category: item.category,
          severity: item.severity,
          audience: item.audience,
          title: item.title,
          summary: item.summary,
          evidence: item.evidence,
          created_by: 'ai',
          score: item.score,
          trigger_id: item.trigger_id,
          status: 'active'
        });
        results.push(created);
      }
    }

    return Response.json({ 
      success: true, 
      items: results,
      signals_detected: signals.length,
      items_created: results.length
    });

  } catch (error) {
    console.error('Error evaluating attention items:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Collect relevant context for evaluation
 */
async function collectContext(base44, entity_type, entity_id) {
  const context = { entity_type, entity_id };

  try {
    if (entity_type === 'customer') {
      const customer = await base44.asServiceRole.entities.Customer.get(entity_id);
      const projects = await base44.asServiceRole.entities.Project.filter({ customer_id: entity_id });
      const emails = await base44.asServiceRole.entities.EmailThread.filter({ linked_customer_id: entity_id });
      
      context.customer = customer;
      context.projects = projects;
      context.emails = emails.slice(0, 10); // Recent 10
    } 
    else if (entity_type === 'project') {
      const project = await base44.asServiceRole.entities.Project.get(entity_id);
      const jobs = await base44.asServiceRole.entities.Job.filter({ project_id: entity_id });
      const emails = await base44.asServiceRole.entities.EmailThread.filter({ linked_project_id: entity_id });
      const invoices = await base44.asServiceRole.entities.XeroInvoice.filter({ project_id: entity_id });
      const parts = await base44.asServiceRole.entities.Part.filter({ project_id: entity_id });
      
      context.project = project;
      context.jobs = jobs;
      context.emails = emails.slice(0, 10);
      context.invoices = invoices;
      context.parts = parts;
    }
    else if (entity_type === 'job') {
      const job = await base44.asServiceRole.entities.Job.get(entity_id);
      const messages = await base44.asServiceRole.entities.JobMessage.filter({ job_id: entity_id });
      
      context.job = job;
      context.messages = messages;
    }
  } catch (error) {
    console.error('Error collecting context:', error);
  }

  return context;
}

/**
 * Detect signals using heuristics
 */
async function detectSignals(context) {
  const signals = [];

  // HEURISTIC 1: Payment Overdue
  if (context.invoices) {
    for (const invoice of context.invoices) {
      if (invoice.status === 'AUTHORISED' && invoice.due_date) {
        const dueDate = new Date(invoice.due_date);
        const daysPast = Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysPast > 7) {
          signals.push({
            category: 'Payments',
            severity: daysPast > 30 ? 'critical' : 'important',
            audience: 'office',
            title: `Invoice ${invoice.invoice_number} overdue by ${daysPast} days`,
            summary: `• Amount: $${invoice.total}\n• Due: ${new Date(invoice.due_date).toLocaleDateString()}`,
            evidence: [{
              source_type: 'XeroInvoice',
              source_id: invoice.id,
              excerpt: `Invoice ${invoice.invoice_number} - Due ${invoice.due_date}`
            }],
            score: Math.min(100, 60 + daysPast),
            trigger_id: `payment_overdue_${invoice.id}`
          });
        }
      }
    }
  }

  // HEURISTIC 2: Negative sentiment in emails
  if (context.emails) {
    const negativeKeywords = ['urgent', 'asap', 'complaint', 'unhappy', 'disappointed', 'frustrated', 'unacceptable', 'poor', 'terrible'];
    
    for (const email of context.emails) {
      const subject = (email.subject || '').toLowerCase();
      const snippet = (email.last_message_snippet || '').toLowerCase();
      const combined = subject + ' ' + snippet;
      
      const matchCount = negativeKeywords.filter(kw => combined.includes(kw)).length;
      
      if (matchCount >= 2) {
        signals.push({
          category: 'Customer Sentiment',
          severity: matchCount >= 3 ? 'critical' : 'important',
          audience: 'both',
          title: 'Potentially negative customer communication',
          summary: `• Email: ${email.subject}\n• Detected ${matchCount} concern indicators`,
          evidence: [{
            source_type: 'EmailThread',
            source_id: email.id,
            excerpt: email.last_message_snippet?.substring(0, 200)
          }],
          score: 65 + (matchCount * 10),
          trigger_id: `sentiment_${email.id}`
        });
      }
    }
  }

  // HEURISTIC 3: Parts shortage/delay
  if (context.parts) {
    const problematicParts = context.parts.filter(p => 
      p.status === 'on_order' && p.eta && new Date(p.eta) < new Date()
    );
    
    if (problematicParts.length > 0) {
      signals.push({
        category: 'Logistics',
        severity: 'important',
        audience: 'both',
        title: `${problematicParts.length} part(s) overdue`,
        summary: `• ${problematicParts.map(p => p.item_name).join(', ')}\n• Expected earlier, still on order`,
        evidence: problematicParts.map(p => ({
          source_type: 'Part',
          source_id: p.id,
          excerpt: `${p.item_name} - ETA: ${p.eta}`
        })),
        score: 75,
        trigger_id: `parts_delay_${context.entity_id}`
      });
    }
  }

  // HEURISTIC 4: Access issues mentioned
  if (context.job) {
    const notes = (context.job.notes || '') + ' ' + (context.job.completion_notes || '');
    const accessKeywords = ['locked', 'no access', 'gate code', 'key', 'cannot enter', "couldn't access"];
    
    if (accessKeywords.some(kw => notes.toLowerCase().includes(kw))) {
      signals.push({
        category: 'Access & Site',
        severity: 'important',
        audience: 'technician',
        title: 'Site access issue noted',
        summary: '• Review job notes for access requirements\n• Coordinate with customer before visit',
        evidence: [{
          source_type: 'Job',
          source_id: context.job.id,
          excerpt: notes.substring(0, 200)
        }],
        score: 70,
        trigger_id: `access_${context.job.id}`
      });
    }
  }

  // HEURISTIC 5: Multiple reschedules
  if (context.job && context.job.scheduled_visits && context.job.scheduled_visits.length > 3) {
    const cancelledCount = context.job.scheduled_visits.filter(v => v.status === 'cancelled').length;
    
    if (cancelledCount >= 2) {
      signals.push({
        category: 'Operational',
        severity: 'important',
        audience: 'office',
        title: `Job rescheduled ${cancelledCount} times`,
        summary: '• Review scheduling conflicts\n• Consider customer availability patterns',
        evidence: [{
          source_type: 'Job',
          source_id: context.job.id,
          excerpt: `${cancelledCount} cancelled visits out of ${context.job.scheduled_visits.length} total`
        }],
        score: 70,
        trigger_id: `reschedule_${context.job.id}`
      });
    }
  }

  return signals;
}