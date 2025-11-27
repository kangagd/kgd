import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { project_id, job_id, optimization_type = 'full' } = await req.json();

    // Fetch relevant data
    const [allJobs, allProjects, technicians, jobTypes] = await Promise.all([
      base44.entities.Job.filter({ deleted_at: null }),
      base44.entities.Project.filter({ deleted_at: null }),
      base44.entities.User.filter({ is_field_technician: true }),
      base44.entities.JobType.list()
    ]);

    // Get target project/job
    let targetProject = null;
    let targetJob = null;
    let relatedJobs = [];

    if (project_id) {
      targetProject = allProjects.find(p => p.id === project_id);
      relatedJobs = allJobs.filter(j => j.project_id === project_id);
    }
    
    if (job_id) {
      targetJob = allJobs.find(j => j.id === job_id);
      if (targetJob?.project_id) {
        targetProject = allProjects.find(p => p.id === targetJob.project_id);
        relatedJobs = allJobs.filter(j => j.project_id === targetJob.project_id);
      }
    }

    // Build context for AI
    const today = new Date();
    const nextTwoWeeks = new Date(today);
    nextTwoWeeks.setDate(nextTwoWeeks.getDate() + 14);

    // Calculate technician workloads
    const technicianWorkloads = technicians.map(tech => {
      const assignedJobs = allJobs.filter(j => 
        j.assigned_to?.includes(tech.email) && 
        j.status !== 'Completed' && 
        j.status !== 'Cancelled'
      );
      
      const scheduledThisWeek = assignedJobs.filter(j => {
        if (!j.scheduled_date) return false;
        const jobDate = new Date(j.scheduled_date);
        const weekFromNow = new Date(today);
        weekFromNow.setDate(weekFromNow.getDate() + 7);
        return jobDate >= today && jobDate <= weekFromNow;
      });

      const scheduledNextWeek = assignedJobs.filter(j => {
        if (!j.scheduled_date) return false;
        const jobDate = new Date(j.scheduled_date);
        const weekFromNow = new Date(today);
        weekFromNow.setDate(weekFromNow.getDate() + 7);
        const twoWeeksFromNow = new Date(today);
        twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
        return jobDate > weekFromNow && jobDate <= twoWeeksFromNow;
      });

      return {
        email: tech.email,
        name: tech.full_name || tech.email,
        open_jobs: assignedJobs.length,
        jobs_this_week: scheduledThisWeek.length,
        jobs_next_week: scheduledNextWeek.length,
        specialties: tech.specialties || []
      };
    });

    // Find scheduling conflicts and gaps
    const scheduledJobs = allJobs.filter(j => 
      j.scheduled_date && 
      j.status !== 'Completed' && 
      j.status !== 'Cancelled'
    );

    // Group jobs by date and technician to find busy days
    const scheduleByDateAndTech = {};
    scheduledJobs.forEach(job => {
      const date = job.scheduled_date;
      if (!scheduleByDateAndTech[date]) scheduleByDateAndTech[date] = {};
      (job.assigned_to || []).forEach(email => {
        if (!scheduleByDateAndTech[date][email]) scheduleByDateAndTech[date][email] = [];
        scheduleByDateAndTech[date][email].push({
          job_number: job.job_number,
          time: job.scheduled_time,
          duration: job.expected_duration || 2,
          suburb: job.address_suburb
        });
      });
    });

    // Build AI prompt
    const prompt = `You are an expert field service scheduling optimizer for a garage door installation and repair company.

CURRENT DATE: ${today.toISOString().split('T')[0]}

${targetProject ? `
TARGET PROJECT:
- Title: ${targetProject.title}
- Type: ${targetProject.project_type || 'Not specified'}
- Status: ${targetProject.status}
- Customer: ${targetProject.customer_name}
- Location: ${targetProject.address_suburb || targetProject.address_full || 'Unknown'}
- Description: ${targetProject.description || 'None'}
- Doors: ${JSON.stringify(targetProject.doors || [])}
` : ''}

${targetJob ? `
TARGET JOB:
- Job #${targetJob.job_number}
- Type: ${targetJob.job_type_name || 'General'}
- Status: ${targetJob.status}
- Current Schedule: ${targetJob.scheduled_date || 'Not scheduled'} ${targetJob.scheduled_time || ''}
- Assigned To: ${targetJob.assigned_to_name?.join(', ') || 'Unassigned'}
- Location: ${targetJob.address_suburb || targetJob.address_full || 'Unknown'}
- Expected Duration: ${targetJob.expected_duration || 'Not set'} hours
` : ''}

RELATED JOBS FOR THIS PROJECT:
${relatedJobs.map(j => `- Job #${j.job_number}: ${j.job_type_name || 'General'} - ${j.status} - ${j.scheduled_date || 'Unscheduled'}`).join('\n') || 'None'}

TECHNICIAN AVAILABILITY:
${technicianWorkloads.map(t => 
  `- ${t.name}: ${t.jobs_this_week} jobs this week, ${t.jobs_next_week} jobs next week, ${t.open_jobs} total open`
).join('\n')}

EXISTING SCHEDULE (Next 2 Weeks):
${Object.entries(scheduleByDateAndTech)
  .filter(([date]) => new Date(date) >= today && new Date(date) <= nextTwoWeeks)
  .sort(([a], [b]) => a.localeCompare(b))
  .slice(0, 10)
  .map(([date, techs]) => 
    `${date}: ${Object.entries(techs).map(([email, jobs]) => {
      const techName = technicians.find(t => t.email === email)?.full_name || email;
      return `${techName} (${jobs.length} jobs)`;
    }).join(', ')}`
  ).join('\n') || 'No scheduled jobs'}

JOB TYPES & TYPICAL DURATIONS:
${jobTypes.map(jt => `- ${jt.name}: ~${jt.estimated_duration || 2} hours`).join('\n')}

SCHEDULING RULES:
1. Initial Site Measures should be 1-2 hours
2. Final Measures should be 1-2 hours
3. Installations typically need 4-8 hours depending on complexity
4. Repairs are usually 1-3 hours
5. Same technician should handle related jobs when possible for continuity
6. Consider travel time between suburbs (jobs in same suburb can be grouped)
7. Avoid overloading any single technician
8. Morning slots (8am-12pm) preferred for installations
9. Afternoon slots good for measures and repairs

Provide scheduling optimization suggestions in the following JSON format:
{
  "suggested_schedule": {
    "recommended_date": "YYYY-MM-DD",
    "recommended_time": "HH:MM",
    "recommended_technicians": ["technician email"],
    "reasoning": "Brief explanation"
  },
  "estimated_duration": {
    "hours": number,
    "confidence": "high/medium/low",
    "factors": ["factor1", "factor2"]
  },
  "project_timeline": {
    "estimated_completion_date": "YYYY-MM-DD",
    "remaining_steps": ["step1", "step2"],
    "bottlenecks": ["potential issue"]
  },
  "technician_recommendations": [
    {
      "email": "tech email",
      "name": "Tech Name",
      "score": 1-10,
      "reasons": ["reason1", "reason2"]
    }
  ],
  "alternative_slots": [
    {
      "date": "YYYY-MM-DD",
      "time": "HH:MM",
      "available_technicians": ["name"]
    }
  ],
  "optimization_tips": ["tip1", "tip2"]
}`;

    const aiResponse = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          suggested_schedule: {
            type: "object",
            properties: {
              recommended_date: { type: "string" },
              recommended_time: { type: "string" },
              recommended_technicians: { type: "array", items: { type: "string" } },
              reasoning: { type: "string" }
            }
          },
          estimated_duration: {
            type: "object",
            properties: {
              hours: { type: "number" },
              confidence: { type: "string" },
              factors: { type: "array", items: { type: "string" } }
            }
          },
          project_timeline: {
            type: "object",
            properties: {
              estimated_completion_date: { type: "string" },
              remaining_steps: { type: "array", items: { type: "string" } },
              bottlenecks: { type: "array", items: { type: "string" } }
            }
          },
          technician_recommendations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                email: { type: "string" },
                name: { type: "string" },
                score: { type: "number" },
                reasons: { type: "array", items: { type: "string" } }
              }
            }
          },
          alternative_slots: {
            type: "array",
            items: {
              type: "object",
              properties: {
                date: { type: "string" },
                time: { type: "string" },
                available_technicians: { type: "array", items: { type: "string" } }
              }
            }
          },
          optimization_tips: { type: "array", items: { type: "string" } }
        }
      }
    });

    return Response.json({
      success: true,
      optimization: aiResponse,
      context: {
        technician_workloads: technicianWorkloads,
        project: targetProject ? {
          id: targetProject.id,
          title: targetProject.title,
          status: targetProject.status
        } : null,
        job: targetJob ? {
          id: targetJob.id,
          job_number: targetJob.job_number,
          status: targetJob.status
        } : null
      }
    });

  } catch (error) {
    console.error('AI Schedule Optimizer error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});