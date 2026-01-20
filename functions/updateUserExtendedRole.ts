import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify admin access
    const user = await base44.auth.me();
    if (user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { email, extended_role } = await req.json();

    if (!email || !extended_role) {
      return Response.json({ error: 'Email and extended_role are required' }, { status: 400 });
    }

    // Valid extended_role values
    const validRoles = ['manager', 'technician', null];
    if (!validRoles.includes(extended_role)) {
      return Response.json({ error: 'Invalid extended_role. Must be "manager", "technician", or null' }, { status: 400 });
    }

    // Get the user to update
    const users = await base44.asServiceRole.entities.User.filter({ email });
    
    if (users.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const targetUser = users[0];

    // Update the user's extended_role
    await base44.asServiceRole.entities.User.update(targetUser.id, {
      extended_role
    });

    return Response.json({ 
      success: true, 
      message: `Updated ${email} to extended_role: ${extended_role}`,
      user: {
        email,
        extended_role
      }
    });

  } catch (error) {
    console.error('Error updating user extended_role:', error);
    return Response.json({ 
      error: error.message || 'Failed to update user extended_role' 
    }, { status: 500 });
  }
});