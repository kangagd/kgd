import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify'
];

/**
 * Convert PEM private key to ArrayBuffer
 */
function pemToArrayBuffer(pem) {
  const pemContent = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  
  const binaryString = atob(pemContent);
  const bytes = new Uint8Array(binaryString.length);
  
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return bytes.buffer;
}

/**
 * Generate JWT for Google Service Account with subject impersonation
 */
async function createJWT(serviceAccountEmail, privateKey, subject, scopes) {
  const now = Math.floor(Date.now() / 1000);
  
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };
  
  const payload = {
    iss: serviceAccountEmail,
    sub: subject,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };
  
  const encodedHeader = btoa(JSON.stringify(header))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  const encodedPayload = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKey),
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['sign']
  );
  
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    encoder.encode(signatureInput)
  );
  
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  return `${signatureInput}.${encodedSignature}`;
}

/**
 * Mask sensitive token for logging
 */
function maskToken(token) {
  if (!token || token.length < 10) return '[invalid]';
  return `${token.substring(0, 6)}...${token.substring(token.length - 4)}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate Base44 user
    const currentUser = await base44.auth.me();
    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Load environment variables
    const serviceAccountEmail = Deno.env.get('GOOGLE_WORKSPACE_SERVICE_ACCOUNT_CLIENT_EMAIL');
    const privateKeyRaw = Deno.env.get('GOOGLE_WORKSPACE_SERVICE_ACCOUNT_PRIVATE_KEY');
    const impersonateEmail = Deno.env.get('GMAIL_DWD_IMPERSONATE_EMAIL') || 'admin@kangaroogd.com.au';
    const scopesRaw = Deno.env.get('GOOGLE_WORKSPACE_DWD_SCOPES');
    const scopes = scopesRaw ? scopesRaw.split(',').map(s => s.trim()) : DEFAULT_SCOPES;
    
    // Validate environment variables
    const envCheck = {
      serviceAccountEmail: !!serviceAccountEmail,
      privateKey: !!privateKeyRaw,
      impersonateEmail: !!impersonateEmail,
      scopes: scopes.length > 0
    };
    
    if (!serviceAccountEmail || !privateKeyRaw) {
      return Response.json({
        success: false,
        stage: 'env_validation',
        error: 'Missing required environment variables',
        envCheck,
        config: {
          serviceAccountEmail: serviceAccountEmail ? maskToken(serviceAccountEmail) : '[missing]',
          impersonateEmail,
          scopes
        }
      }, { status: 500 });
    }
    
    // Handle escaped newlines in private key
    const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
    
    const diagnostic = {
      success: false,
      stage: null,
      config: {
        serviceAccountEmail: maskToken(serviceAccountEmail),
        impersonateEmail,
        scopes,
        user: currentUser.email
      }
    };
    
    // STAGE 1: Create JWT assertion
    let jwt;
    try {
      jwt = await createJWT(serviceAccountEmail, privateKey, impersonateEmail, scopes);
      diagnostic.jwt = {
        created: true,
        masked: maskToken(jwt)
      };
    } catch (error) {
      diagnostic.stage = 'jwt_creation';
      diagnostic.error = error.message;
      return Response.json(diagnostic, { status: 500 });
    }
    
    // STAGE 2: Exchange JWT for access token
    diagnostic.stage = 'token_exchange';
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      })
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      diagnostic.tokenExchange = {
        statusCode: tokenResponse.status,
        error: errorText.substring(0, 2000)
      };
      return Response.json(diagnostic, { status: 500 });
    }
    
    const tokenData = await tokenResponse.json();
    diagnostic.tokenExchange = {
      success: true,
      accessToken: maskToken(tokenData.access_token),
      expiresIn: tokenData.expires_in,
      tokenType: tokenData.token_type
    };
    
    // STAGE 3: Validate token with tokeninfo
    diagnostic.stage = 'tokeninfo';
    const tokenInfoResponse = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${tokenData.access_token}`
    );
    
    if (!tokenInfoResponse.ok) {
      const errorText = await tokenInfoResponse.text();
      diagnostic.tokenInfo = {
        statusCode: tokenInfoResponse.status,
        error: errorText.substring(0, 2000)
      };
      return Response.json(diagnostic, { status: 500 });
    }
    
    const tokenInfo = await tokenInfoResponse.json();
    diagnostic.tokenInfo = {
      scope: tokenInfo.scope,
      expires_in: tokenInfo.expires_in,
      email: tokenInfo.email || tokenInfo.sub,
      azp: tokenInfo.azp
    };
    
    // STAGE 4: Call Gmail profile API
    diagnostic.stage = 'gmail_profile';
    const profileResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/profile',
      {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      }
    );
    
    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      diagnostic.gmailProfile = {
        statusCode: profileResponse.status,
        error: errorText.substring(0, 2000)
      };
      return Response.json(diagnostic, { status: 500 });
    }
    
    const profile = await profileResponse.json();
    diagnostic.success = true;
    diagnostic.gmailProfile = {
      emailAddress: profile.emailAddress,
      messagesTotal: profile.messagesTotal || 0,
      threadsTotal: profile.threadsTotal || 0,
      historyId: profile.historyId
    };
    
    return Response.json(diagnostic);
  } catch (error) {
    return Response.json({
      success: false,
      stage: 'exception',
      error: error.message,
      stack: error.stack?.substring(0, 1000)
    }, { status: 500 });
  }
});