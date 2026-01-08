/**
 * Validation Utilities - Guardrails for Data Integrity
 * 
 * All critical operations should use these validators before making changes
 */

export class ValidationError extends Error {
  constructor(message, violations = []) {
    super(message);
    this.name = 'ValidationError';
    this.violations = violations;
  }
}

/**
 * Validate XeroInvoice before create/update
 */
export function validateXeroInvoice(data) {
  const violations = [];

  // Required fields
  if (!data.xero_invoice_id) violations.push('xero_invoice_id is required');
  if (!data.status) violations.push('status is required');

  // Field naming consistency
  if (data.invoice_number && !data.xero_invoice_number) {
    violations.push('Use xero_invoice_number, not invoice_number (deprecated field)');
  }
  if (data.raw_data && !data.raw_payload) {
    violations.push('Use raw_payload, not raw_data (deprecated field)');
  }

  // Status enum validation
  const validStatuses = ['DRAFT', 'SUBMITTED', 'AUTHORISED', 'PAID', 'VOIDED', 'OVERDUE'];
  if (data.status && !validStatuses.includes(data.status)) {
    violations.push(`Invalid status: ${data.status}. Must be one of: ${validStatuses.join(', ')}`);
  }

  // Ensure both total and total_amount are set
  if (data.total && !data.total_amount) {
    violations.push('total_amount must match total for consistency');
  }
  if (data.date && !data.issue_date) {
    violations.push('issue_date must match date for consistency');
  }

  // Link integrity
  if (data.project_id && data.job_id) {
    violations.push('Invoice cannot be linked to both project and job simultaneously');
  }

  if (violations.length > 0) {
    throw new ValidationError('XeroInvoice validation failed', violations);
  }

  // Auto-fix common issues
  const normalized = { ...data };
  if (data.total && !data.total_amount) normalized.total_amount = data.total;
  if (data.date && !data.issue_date) normalized.issue_date = data.date;
  if (data.online_payment_url && !data.online_invoice_url) {
    normalized.online_invoice_url = data.online_payment_url;
  }

  return normalized;
}

/**
 * Validate Project before create/update
 */
export function validateProject(data) {
  const violations = [];

  // Required fields
  if (!data.title) violations.push('title is required');

  // Check for locked fields
  if (data.financial_value_locked === false && data.total_project_value !== undefined) {
    console.warn('⚠️ Updating total_project_value when financial_value_locked is false');
  }

  // Invoice linking integrity
  if (data.xero_invoices && !Array.isArray(data.xero_invoices)) {
    violations.push('xero_invoices must be an array');
  }

  if (data.primary_xero_invoice_id && data.xero_invoices) {
    if (!data.xero_invoices.includes(data.primary_xero_invoice_id)) {
      violations.push('primary_xero_invoice_id must be in xero_invoices array');
    }
  }

  if (violations.length > 0) {
    throw new ValidationError('Project validation failed', violations);
  }

  return data;
}

/**
 * Validate Quote before create/update
 */
export function validateQuote(data) {
  const violations = [];

  if (!data.customer_id) violations.push('customer_id is required');
  if (!data.name) violations.push('name is required');

  // Status enum
  const validStatuses = ['Draft', 'Sent', 'Viewed', 'Accepted', 'Declined', 'Expired'];
  if (data.status && !validStatuses.includes(data.status)) {
    violations.push(`Invalid status: ${data.status}. Must be one of: ${validStatuses.join(', ')}`);
  }

  if (violations.length > 0) {
    throw new ValidationError('Quote validation failed', violations);
  }

  return data;
}

/**
 * Validate Part before create/update
 */
export function validatePart(data) {
  const violations = [];

  if (!data.project_id) violations.push('project_id is required for Part');
  if (!data.category) violations.push('category is required');
  if (!data.status) violations.push('status is required');

  if (violations.length > 0) {
    throw new ValidationError('Part validation failed', violations);
  }

  return data;
}

/**
 * Pre-flight check: Can we link this invoice to this project?
 */
export async function canLinkInvoiceToProject(base44, invoiceId, projectId) {
  const issues = [];

  // Check if invoice exists
  try {
    const invoice = await base44.asServiceRole.entities.XeroInvoice.get(invoiceId);
    if (!invoice) {
      issues.push('Invoice not found');
      return { allowed: false, issues };
    }

    // Check if already linked to another project
    if (invoice.project_id && invoice.project_id !== projectId) {
      const otherProject = await base44.asServiceRole.entities.Project.get(invoice.project_id);
      issues.push(`Invoice already linked to project #${otherProject?.project_number || invoice.project_id}`);
    }

    // Check if already linked to a job
    if (invoice.job_id) {
      issues.push(`Invoice already linked to job #${invoice.job_id}`);
    }
  } catch (error) {
    issues.push(`Error checking invoice: ${error.message}`);
  }

  // Check if project exists and is not deleted
  try {
    const project = await base44.asServiceRole.entities.Project.get(projectId);
    if (!project) {
      issues.push('Project not found');
    } else if (project.deleted_at) {
      issues.push('Cannot link to deleted project');
    }
  } catch (error) {
    issues.push(`Error checking project: ${error.message}`);
  }

  return { allowed: issues.length === 0, issues };
}

/**
 * Pre-flight check: Can we delete this entity?
 */
export async function canDeleteEntity(base44, entityType, entityId) {
  const issues = [];
  
  if (entityType === 'Project') {
    const jobs = await base44.asServiceRole.entities.Job.filter({ project_id: entityId, deleted_at: null });
    if (jobs.length > 0) issues.push(`${jobs.length} active jobs linked`);

    const parts = await base44.asServiceRole.entities.Part.filter({ project_id: entityId });
    if (parts.length > 0) issues.push(`${parts.length} parts linked`);

    const quotes = await base44.asServiceRole.entities.Quote.filter({ project_id: entityId });
    if (quotes.length > 0) issues.push(`${quotes.length} quotes linked`);
  }

  if (entityType === 'Customer') {
    const projects = await base44.asServiceRole.entities.Project.filter({ customer_id: entityId, deleted_at: null });
    if (projects.length > 0) issues.push(`${projects.length} active projects linked`);

    const jobs = await base44.asServiceRole.entities.Job.filter({ customer_id: entityId, deleted_at: null });
    if (jobs.length > 0) issues.push(`${jobs.length} active jobs linked`);
  }

  return { allowed: issues.length === 0, issues };
}

/**
 * Log validation violation for audit trail
 */
export function logViolation(context, violations) {
  const log = {
    timestamp: new Date().toISOString(),
    context,
    violations,
    stack: new Error().stack
  };
  console.error('🚨 VALIDATION VIOLATION:', JSON.stringify(log, null, 2));
}