import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const currentUser = await base44.auth.me();
    if (!currentUser) {
      return Response.json({ connected: false }, { status: 200 });
    }

    // Check if ANY user with this email has Gmail connected
    const usersWithSameEmail = await base44.asServiceRole.entities.User.filter({ 
      email: currentUser.email 
    });
    
    const hasConnection = usersWithSameEmail.some(u => u.gmail_access_token);
    
    return Response.json({ connected: hasConnection });
  } catch (error) {
    console.error('Error checking Gmail connection:', error);
    return Response.json({ connected: false }, { status: 200 });
  }
});