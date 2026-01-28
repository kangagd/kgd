import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Shared Gmail API client wrapper.
 * Handles OAuth token retrieval and API calls.
 */
export async function gmailFetch(
  path: string,
  method: string = 'GET',
  body?: any
): Promise<any> {
  // Get access token from app connector (function role elevation)
  const base44 = createClientFromRequest(new Request('http://localhost'));
  const token = await base44.asServiceRole.connectors.getAccessToken('gmail');

  const url = `https://www.googleapis.com${path}`;
  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Gmail API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}