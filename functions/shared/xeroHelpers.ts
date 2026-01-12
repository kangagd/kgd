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
    throw new Error('XERO_NOT_CONNECTED');
  }

  const connection = connections[0];
  
  // Check if connection is marked as expired
  if (connection.is_expired) {
    throw new Error('XERO_AUTH_EXPIRED');
  }
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
      
      // Mark connection as expired in database
      await base44.asServiceRole.entities.XeroConnection.update(connection.id, {
        is_expired: true,
        last_error: `Token refresh failed at ${new Date().toISOString()}: ${error}`
      });
      
      throw new Error('XERO_AUTH_EXPIRED');
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

/**
 * Make a Xero API request with automatic retry logic
 * 
 * @param {string} url - Xero API endpoint URL
 * @param {Object} options - Fetch options
 * @param {number} maxRetries - Maximum retry attempts (default: 3)
 * @returns {Promise<Response>} Fetch response
 */
export async function xeroFetchWithRetry(url, options = {}, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // Success cases
      if (response.ok) {
        return response;
      }
      
      // Rate limit - wait and retry
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
        console.log(`Rate limited, waiting ${retryAfter}s before retry ${attempt + 1}/${maxRetries}`);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          continue;
        }
      }
      
      // Server errors - retry with exponential backoff
      if (response.status >= 500) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 30000);
        console.log(`Server error ${response.status}, retrying in ${backoffMs}ms (${attempt + 1}/${maxRetries})`);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          continue;
        }
      }
      
      // Client errors - don't retry (400, 401, 403, 404, etc.)
      return response;
      
    } catch (error) {
      lastError = error;
      console.error(`Network error on attempt ${attempt + 1}/${maxRetries}:`, error.message);
      
      if (attempt < maxRetries) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 30000);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue;
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

/**
 * Check if Xero connection is healthy and refresh if needed
 * 
 * @param {Object} base44 - Base44 SDK client
 * @returns {Promise<Object>} Connection object or throws error
 */
export async function ensureXeroConnectionHealthy(base44) {
  try {
    const connection = await refreshAndGetXeroConnection(base44);
    
    // Test connection with a lightweight API call
    const testResponse = await xeroFetchWithRetry(
      'https://api.xero.com/connections',
      {
        headers: {
          'Authorization': `Bearer ${connection.access_token}`,
          'Content-Type': 'application/json'
        }
      },
      1 // Only 1 retry for health check
    );
    
    if (!testResponse.ok) {
      console.error('Xero connection health check failed:', testResponse.status);
      
      // Mark as expired if auth fails
      if (testResponse.status === 401 || testResponse.status === 403) {
        await base44.asServiceRole.entities.XeroConnection.update(connection.id, {
          is_expired: true,
          last_error: `Health check failed: ${testResponse.status} at ${new Date().toISOString()}`
        });
        throw new Error('XERO_AUTH_EXPIRED');
      }
    }
    
    return connection;
  } catch (error) {
    console.error('Xero connection health check error:', error);
    throw error;
  }
}