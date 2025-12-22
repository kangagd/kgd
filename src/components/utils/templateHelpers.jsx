/**
 * Render a message template by replacing variables with context values
 * @param {Object} template - MessageTemplate entity
 * @param {Object} context - Context data for variable replacement
 * @returns {Object} { subject: string, body: string }
 */
export function renderTemplate(template, context = {}) {
  if (!template) return { subject: '', body: '' };

  const replace = (text) => {
    if (!text) return '';
    
    let result = text;
    
    // Replace all {variable_name} patterns
    Object.keys(context).forEach(key => {
      const regex = new RegExp(`\\{${key}\\}`, 'gi');
      const value = context[key] !== null && context[key] !== undefined ? String(context[key]) : '';
      result = result.replace(regex, value);
    });
    
    return result;
  };

  return {
    subject: replace(template.subject || ''),
    body: replace(template.body || '')
  };
}

/**
 * Extract context from common entities
 * @param {Object} options
 * @param {Object} options.customer - Customer entity
 * @param {Object} options.job - Job entity
 * @param {Object} options.project - Project entity
 * @param {Object} options.invoice - Invoice/XeroInvoice entity
 * @returns {Object} Context for template rendering
 */
export function buildTemplateContext({ customer, job, project, invoice } = {}) {
  return {
    customer_name: customer?.name || job?.customer_name || project?.customer_name || '',
    customer_email: customer?.email || job?.customer_email || project?.customer_email || '',
    customer_phone: customer?.phone || job?.customer_phone || project?.customer_phone || '',
    job_number: job?.job_number || '',
    job_type: job?.job_type_name || job?.job_type || '',
    project_title: project?.title || job?.project_name || '',
    project_number: project?.project_number || '',
    address: job?.address_full || project?.address_full || customer?.address_full || '',
    scheduled_date: job?.scheduled_date || '',
    scheduled_time: job?.scheduled_time || '',
    invoice_number: invoice?.xero_invoice_number || invoice?.invoice_number || '',
    invoice_amount: invoice?.total || invoice?.total_amount || '',
    invoice_link: invoice?.online_payment_url || '',
    invoice_pdf: invoice?.pdf_url || ''
  };
}