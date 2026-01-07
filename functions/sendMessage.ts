import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { updateProjectActivity } from './updateProjectActivity.js';

Deno.serve(async (req) => {
  try {
    // CRITICAL: Validate request method
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    
    // CRITICAL: Authentication check
    const user = await base44.auth.me();
    if (!user || !user.email) {
      console.error('[sendMessage] Authentication failed');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, entityId, message } = await req.json();

    // CRITICAL: Validate required fields
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return Response.json({ error: 'Valid message is required' }, { status: 400 });
    }
    if (!type || !['project', 'job'].includes(type)) {
      return Response.json({ error: 'Valid type (project/job) is required' }, { status: 400 });
    }
    if (!entityId || typeof entityId !== 'string') {
      return Response.json({ error: 'Valid entityId is required' }, { status: 400 });
    }

    console.log(`[sendMessage] User ${user.email} sending ${type} message to ${entityId}`);

    // 1. Get all users for mention parsing - call getAllUsers backend function
    let allUsers = [];
    try {
      const usersResponse = await base44.functions.invoke('getAllUsers', {});
      allUsers = usersResponse.data?.users || [];
      console.log(`[sendMessage] Fetched ${allUsers.length} users for mention parsing`);
    } catch (error) {
      console.error('[sendMessage] Failed to fetch users for mentions:', error);
      // Continue without mention parsing rather than failing the whole message
      allUsers = [];
    }
    
    // 2. Parse mentions
    const mentionedUsers = [];
    if (allUsers.length > 0) {
      const mentionRegex = /@(\w+(?:\s+\w+)?)/g;
      let match;
      
      while ((match = mentionRegex.exec(message)) !== null) {
        const mentionedName = match[1];
        const mentionedUser = allUsers.find(u => 
          (u.display_name || u.full_name)?.toLowerCase() === mentionedName.toLowerCase()
        );
        
        // Don't notify self
        if (mentionedUser && mentionedUser.email !== user.email && !mentionedUsers.includes(mentionedUser.email)) {
          mentionedUsers.push(mentionedUser.email);
        }
      }
    }

    let newMessage;
    let notificationTitle = '';
    let notificationBody = '';
    let relatedEntityType = '';

    // 3. Create Message Entity and Prepare Notification
    if (type === 'project') {
      const projects = await base44.entities.Project.filter({ id: entityId });
      const project = projects[0];
      
      if (!project) throw new Error('Project not found');

      newMessage = await base44.entities.ProjectMessage.create({
        project_id: entityId,
        sender_email: user.email,
        sender_name: user.display_name || user.full_name,
        message: message,
        mentioned_users: mentionedUsers
      });
      
      // Update project activity when message is sent
      await updateProjectActivity(base44, entityId);
      
      notificationTitle = `New mention in ${project.title}`;
      notificationBody = `${user.display_name || user.full_name} mentioned you: "${message.length > 50 ? message.substring(0, 50) + '...' : message}"`;
      relatedEntityType = 'Project';

    } else if (type === 'job') {
      const jobs = await base44.entities.Job.filter({ id: entityId });
      const job = jobs[0];
      
      if (!job) throw new Error('Job not found');

      newMessage = await base44.entities.JobMessage.create({
        job_id: entityId,
        sender_email: user.email,
        sender_name: user.display_name || user.full_name,
        message: message,
        mentioned_users: mentionedUsers
      });

      // Update project activity if job is linked to a project
      if (job.project_id) {
        await updateProjectActivity(base44, job.project_id);
      }

      notificationTitle = `New mention in Job #${job.job_number}`;
      notificationBody = `${user.display_name || user.full_name} mentioned you: "${message.length > 50 ? message.substring(0, 50) + '...' : message}"`;
      relatedEntityType = 'Job';
    } else {
      return Response.json({ error: 'Invalid type' }, { status: 400 });
    }

    // 4. Create Notifications for mentioned users
    if (mentionedUsers.length > 0) {
      // Use service role to create notifications for other users
      await Promise.all(mentionedUsers.map(async (email) => {
        const recipient = allUsers.find(u => u.email === email);
        if (recipient) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: recipient.id,
            user_email: email,
            title: notificationTitle,
            body: notificationBody,
            type: 'info',
            related_entity_type: relatedEntityType,
            related_entity_id: entityId,
            is_read: false,
            read_at: null
          });
        }
      }));
    }

    return Response.json({ success: true, message: newMessage });

  } catch (error) {
    console.error('sendMessage error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});