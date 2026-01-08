/**
 * Parameter Normalization Helper
 * 
 * GUARDRAIL: All backend functions should use this helper to normalize parameters
 * from both camelCase (frontend convention) and snake_case (backend convention).
 * 
 * This prevents parameter mismatch errors between frontend and backend.
 * 
 * Usage:
 *   const { project_id, job_id } = normalizeParams(body);
 * 
 * Accepts body with either:
 *   { projectId: "123", jobId: "456" } (camelCase from frontend)
 *   { project_id: "123", job_id: "456" } (snake_case)
 *   Mix of both
 */

export function normalizeParams(params) {
  if (!params) return {};
  
  return {
    // Project & Job
    project_id: params.project_id || params.projectId || null,
    job_id: params.job_id || params.jobId || null,
    
    // Quote & Invoice
    quote_id: params.quote_id || params.quoteId || null,
    invoice_id: params.invoice_id || params.invoiceId || null,
    
    // Customer & Organisation
    customer_id: params.customer_id || params.customerId || null,
    organisation_id: params.organisation_id || params.organisationId || null,
    
    // Document IDs
    pandadoc_document_id: params.pandadoc_document_id || params.pandadocDocumentId || null,
    xero_invoice_id: params.xero_invoice_id || params.xeroInvoiceId || null,
    
    // Other common params
    template_id: params.template_id || params.templateId || null,
    vehicle_id: params.vehicle_id || params.vehicleId || null,
    supplier_id: params.supplier_id || params.supplierId || null,
    purchase_order_id: params.purchase_order_id || params.purchaseOrderId || null,
    
    // Preserve all other parameters as-is
    ...params
  };
}

/**
 * Extract specific normalized params (convenience helper)
 * 
 * Usage:
 *   const { project_id, job_id } = extractParams(body, ['project_id', 'job_id']);
 */
export function extractParams(params, keys) {
  const normalized = normalizeParams(params);
  const result = {};
  
  for (const key of keys) {
    if (normalized[key] !== undefined) {
      result[key] = normalized[key];
    }
  }
  
  return result;
}