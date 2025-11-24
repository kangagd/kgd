import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

async function refreshAndGetConnection(base44) {
  const connections = await base44.asServiceRole.entities.XeroConnection.list();
  if (connections.length === 0) throw new Error('No Xero connection found');
  
  const connection = connections[0];
  const expiresAt = new Date(connection.expires_at);
  
  if (expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    const clientId = Deno.env.get('XERO_CLIENT_ID');
    const clientSecret = Deno.env.get('XERO_CLIENT_SECRET');

    const tokenResponse = await fetch('https://identity.xero.com/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: connection.refresh_token
      })
    });

    if (!tokenResponse.ok) throw new Error('Token refresh failed');
    
    const tokens = await tokenResponse.json();
    const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await base44.asServiceRole.entities.XeroConnection.update(connection.id, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: newExpiresAt
    });

    return { ...connection, access_token: tokens.access_token };
  }

  return connection;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const { customer_id } = await req.json();

    if (!customer_id) {
      return Response.json({ error: 'customer_id is required' }, { status: 400 });
    }

    // Get customer
    const customer = await base44.asServiceRole.entities.Customer.get(customer_id);
    if (!customer) {
      return Response.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Get Xero connection
    const connection = await refreshAndGetConnection(base44);

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
        headers: {
          'Authorization': `Bearer ${connection.access_token}`,
          'xero-tenant-id': connection.xero_tenant_id,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
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
        headers: {
          'Authorization': `Bearer ${connection.access_token}`,
          'xero-tenant-id': connection.xero_tenant_id,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
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