import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get all jobs with project_id
    const jobs = await base44.asServiceRole.entities.Job.filter({});
    const jobsWithProjects = jobs.filter(j => j.project_id);

    let syncedCount = 0;
    let createdCount = 0;

    for (const job of jobsWithProjects) {
      // Get project contacts with show_on_jobs=true
      const projectContacts = await base44.asServiceRole.entities.ProjectContact.filter({
        project_id: job.project_id,
        show_on_jobs: true,
      });

      // Get existing job contacts
      const existingJobContacts = await base44.asServiceRole.entities.JobContact.filter({
        job_id: job.id,
      });

      // Create missing job contacts
      for (const pc of projectContacts) {
        const exists = existingJobContacts.find(jc => 
          jc.contact_id === pc.contact_id || 
          (jc.name === pc.name && jc.email === pc.email)
        );

        if (!exists) {
          await base44.asServiceRole.entities.JobContact.create({
            job_id: job.id,
            contact_id: pc.contact_id || null,
            name: pc.name,
            email: pc.email || "",
            phone: pc.phone || "",
            role: pc.role || "",
          });
          createdCount++;
        }
      }

      syncedCount++;
    }

    return Response.json({ 
      success: true, 
      syncedJobs: syncedCount,
      contactsCreated: createdCount
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});