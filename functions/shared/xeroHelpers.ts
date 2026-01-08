/**
 * Xero Integration Helpers
 * 
 * GUARDRAIL: All Xero-related functions MUST use these helpers instead of 
 * implementing their own token refresh logic. This ensures:
 * - Consistent token management across all Xero integrations
 * - No code duplication
 * - Easy updates when Xero API changes
 * 
 * DO NOT duplicate this logic in individual functions.
 */

import { createClientFromRequest } from './sdk.js';

/**
 * Refresh Xero OAuth token if needed and return connection
 * 
 * @param {Object} base44 - Base44 SDK client instance
 * @returns {Promise<Object>} XeroConnection with fresh access_token
 * @throws {Error} If no connection found or token refresh fails
 */
export async function refreshAndGetXeroConnection(base44) {
  const connections = await base44.asServiceRole.entities.XeroConnection.list();
  
  if (connections.length === 0) {
    throw new Error('No Xero connection found. Please connect Xero first.');
  }

  const connection = connections[0];
  const expiresAt = new Date(connection.expires_at);
  const now = new Date();

  // Refresh if expires in less than 5 minutes
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    const clientId = Deno.env.get('XERO_CLIENT_ID');
    const clientSecret = Deno.env.get('XERO_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error('Xero credentials not configured');
    }

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

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Xero token refresh failed:', error);
      throw new Error('Token refresh failed. Please reconnect Xero.');
    }

    const tokens = await tokenResponse.json();
    const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await base44.asServiceRole.entities.XeroConnection.update(connection.id, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: newExpiresAt
    });

    return {
      ...connection,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: newExpiresAt
    };
  }

  return connection;
}

/**
 * Get Xero API headers for authenticated requests
 * 
 * @param {Object} connection - XeroConnection object with access_token and xero_tenant_id
 * @returns {Object} Headers object ready for fetch requests
 */
export function getXeroHeaders(connection) {
  return {
    'Authorization': `Bearer ${connection.access_token}`,
    'xero-tenant-id': connection.xero_tenant_id,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };
}