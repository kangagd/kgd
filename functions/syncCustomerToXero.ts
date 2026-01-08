import { createClientFromRequest } from './shared/sdk.js';
import { refreshAndGetXeroConnection, getXeroHeaders } from './shared/xeroHelpers.js';
import { normalizeParams } from './shared/parameterNormalizer.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { customer_id } = normalizeParams(body);

    if (!customer_id) {
      return Response.json({ error: 'customer_id is required' }, { status: 400 });
    }

    // Get customer
    const customer = await base44.asServiceRole.entities.Customer.get(customer_id);
    if (!customer) {
      return Response.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Get Xero connection
    const connection = await refreshAndGetXeroConnection(base44);

    // Check if customer already exists in Xero
    let xeroContact;
    if (customer.xero_contact_id) {
      // Update existing contact
      const updatePayload = {
        ContactID: customer.xero_contact_id,
        Name: customer.name,
        EmailAddress: customer.email || '',
        Phones: customer.phone ? [{
          PhoneType: 'MOBILE',
          PhoneNumber: customer.phone
        }] : [],
        Addresses: customer.address_full ? [{
          AddressType: 'STREET',
          AddressLine1: customer.address_street || customer.address_full,
          City: customer.address_suburb || '',
          Region: customer.address_state || '',
          PostalCode: customer.address_postcode || '',
          Country: customer.address_country || 'Australia'
        }] : []
      };

      const response = await fetch(`https://api.xero.com/api.xro/2.0/Contacts/${customer.xero_contact_id}`, {
        method: 'POST',
        headers: getXeroHeaders(connection),
        body: JSON.stringify({ Contacts: [updatePayload] })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to update Xero contact: ${error}`);
      }

      const result = await response.json();
      xeroContact = result.Contacts[0];
    } else {
      // Create new contact
      const createPayload = {
        Name: customer.name,
        EmailAddress: customer.email || '',
        Phones: customer.phone ? [{
          PhoneType: 'MOBILE',
          PhoneNumber: customer.phone
        }] : [],
        Addresses: customer.address_full ? [{
          AddressType: 'STREET',
          AddressLine1: customer.address_street || customer.address_full,
          City: customer.address_suburb || '',
          Region: customer.address_state || '',
          PostalCode: customer.address_postcode || '',
          Country: customer.address_country || 'Australia'
        }] : []
      };

      const response = await fetch('https://api.xero.com/api.xro/2.0/Contacts', {
        method: 'POST',
        headers: getXeroHeaders(connection),
        body: JSON.stringify({ Contacts: [createPayload] })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create Xero contact: ${error}`);
      }

      const result = await response.json();
      xeroContact = result.Contacts[0];

      // Update customer with Xero ID
      await base44.asServiceRole.entities.Customer.update(customer_id, {
        xero_contact_id: xeroContact.ContactID
      });
    }

    return Response.json({
      success: true,
      xero_contact_id: xeroContact.ContactID,
      xero_contact: xeroContact
    });

  } catch (error) {
    console.error('Sync customer error:', error);
    return Response.json({ 
      error: error.message || 'Failed to sync customer to Xero',
      details: error.stack
    }, { status: 500 });
  }
});