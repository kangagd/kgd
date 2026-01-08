import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { 
  validateXeroInvoice, 
  validateProject, 
  validateQuote,
  canLinkInvoiceToProject,
  canDeleteEntity,
  ValidationError
} from './shared/validators.js';

/**
 * Pre-flight Validation Endpoint
 * 
 * Use this to validate operations before executing them
 * Prevents regressions by catching issues early
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { operation, entityType, data, params } = await req.json();

    if (!operation) {
      return Response.json({ error: 'operation is required' }, { status: 400 });
    }

    let result;

    switch (operation) {
      case 'validateEntity': {
        if (!entityType || !data) {
          return Response.json({ error: 'entityType and data required' }, { status: 400 });
        }

        try {
          let validated;
          switch (entityType) {
            case 'XeroInvoice':
              validated = validateXeroInvoice(data);
              break;
            case 'Project':
              validated = validateProject(data);
              break;
            case 'Quote':
              validated = validateQuote(data);
              break;
            default:
              return Response.json({ error: `Validation not implemented for ${entityType}` }, { status: 400 });
          }

          result = {
            valid: true,
            validated_data: validated,
            auto_fixes_applied: Object.keys(validated).filter(k => !data[k])
          };
        } catch (error) {
          if (error instanceof ValidationError) {
            result = {
              valid: false,
              violations: error.violations,
              message: error.message
            };
          } else {
            throw error;
          }
        }
        break;
      }

      case 'canLinkInvoiceToProject': {
        const { invoiceId, projectId } = params || {};
        if (!invoiceId || !projectId) {
          return Response.json({ error: 'invoiceId and projectId required' }, { status: 400 });
        }

        result = await canLinkInvoiceToProject(base44, invoiceId, projectId);
        break;
      }

      case 'canDelete': {
        const { entityType, entityId } = params || {};
        if (!entityType || !entityId) {
          return Response.json({ error: 'entityType and entityId required' }, { status: 400 });
        }

        result = await canDeleteEntity(base44, entityType, entityId);
        break;
      }

      default:
        return Response.json({ error: `Unknown operation: ${operation}` }, { status: 400 });
    }

    return Response.json({
      success: true,
      operation,
      result
    });

  } catch (error) {
    console.error('Validation error:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});