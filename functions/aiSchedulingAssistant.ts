import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Estimate travel time in minutes (rough estimate: 40 km/h average in urban areas)
function estimateTravelTime(distanceKm) {
  return Math.ceil(distanceKm / 40 * 60);
}

// Get coordinates from Google Maps Geocoding API
async function geocodeAddress(address) {
  if (!address || !GOOGLE_MAPS_API_KEY) return null;
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`
    );
    const data = await response.json();
    if (data.results && data.results[0]) {
      return {
        lat: data.results[0].geometry.location.lat,
        lng: data.results[0].geometry.location.lng
      };
    }
  } catch (error) {
    console.error('Geocoding error:', error);
  }
  return null;
}

// Match job requirements to technician skills
function calculateSkillMatch(job, technician) {
  const techSkills = technician.skills || [];
  if (techSkills.length === 0) return 0.5; // No skills defined, neutral score
  
  const jobType = job.job_type_name || job.job_type || '';
  const product = job.product || '';
  
  let matchScore = 0;
  const relevantTerms = [jobType, product].filter(Boolean).map(t => t.toLowerCase());
  
  for (const skill of techSkills) {
    const skillLower = skill.toLowerCase();
    for (const term of relevantTerms) {
      if (skillLower.includes(term) || term.includes(skillLower)) {
        matchScore += 1;
      }
    }
  }
  
  return Math.min(matchScore / Math.max(relevantTerms.length, 1), 1);
}

// Calculate technician workload for a given date
function calculateWorkload(techEmail, jobs, date) {
  const techJobs = jobs.filter(j => 
    j.scheduled_date === date && 
    j.assigned_to?.includes(techEmail)
  );
  return techJobs.length;
}

// Optimize route order using nearest neighbor algorithm
function optimizeRoute(jobs, startLat, startLng) {
  if (jobs.length <= 1) return jobs;
  
  const optimized = [];
  const remaining = [...jobs];
  let currentLat = startLat;
  let currentLng = startLng;
  
  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    
    for (let i = 0; i < remaining.length; i++) {
      const job = remaining[i];
      if (job.latitude && job.longitude) {
        const dist = calculateDistance(currentLat, currentLng, job.latitude, job.longitude);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIdx = i;
        }
      }
    }
    
    const nearest = remaining.splice(nearestIdx, 1)[0];
    optimized.push({
      ...nearest,
      distanceFromPrevious: nearestDist,
      travelTimeFromPrevious: estimateTravelTime(nearestDist)
    });
    
    if (nearest.latitude && nearest.longitude) {
      currentLat = nearest.latitude;
      currentLng = nearest.longitude;
    }
  }
  
  return optimized;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, date, technicianEmail } = body;
    
    // Fetch all necessary data
    const [allJobs, allTechnicians, allCheckIns, jobTypes] = await Promise.all([
      base44.asServiceRole.entities.Job.filter({ deleted_at: null }),
      base44.asServiceRole.entities.User.filter({ is_field_technician: true, status: 'active' }),
      base44.asServiceRole.entities.CheckInOut.list('-created_date', 100),
      base44.asServiceRole.entities.JobType.filter({ is_active: true })
    ]);

    const targetDate = date || new Date().toISOString().split('T')[0];
    
    // Filter jobs for the target date
    const dateJobs = allJobs.filter(j => 
      j.scheduled_date === targetDate && 
      j.status !== 'Cancelled' && 
      j.status !== 'Completed'
    );
    
    // Unassigned jobs (no technician or scheduled date)
    const unassignedJobs = allJobs.filter(j => 
      (!j.assigned_to || j.assigned_to.length === 0) &&
      j.status !== 'Cancelled' && 
      j.status !== 'Completed' &&
      !j.deleted_at
    );

    // Build analysis context for AI
    const analysisContext = {
      date: targetDate,
      technicians: allTechnicians.map(t => ({
        email: t.email,
        name: t.display_name || t.full_name,
        skills: t.skills || [],
        homeAddress: t.home_address,
        homeLat: t.home_latitude,
        homeLng: t.home_longitude,
        maxJobs: t.max_jobs_per_day || 6,
        currentJobCount: calculateWorkload(t.email, allJobs, targetDate)
      })),
      scheduledJobs: dateJobs.map(j => ({
        id: j.id,
        jobNumber: j.job_number,
        customer: j.customer_name,
        address: j.address_full || j.address,
        suburb: j.address_suburb,
        lat: j.latitude,
        lng: j.longitude,
        jobType: j.job_type_name || j.job_type,
        product: j.product,
        scheduledTime: j.scheduled_time,
        expectedDuration: j.expected_duration || 1,
        assignedTo: j.assigned_to || [],
        assignedToNames: j.assigned_to_name || []
      })),
      unassignedJobs: unassignedJobs.slice(0, 20).map(j => ({
        id: j.id,
        jobNumber: j.job_number,
        customer: j.customer_name,
        address: j.address_full || j.address,
        suburb: j.address_suburb,
        lat: j.latitude,
        lng: j.longitude,
        jobType: j.job_type_name || j.job_type,
        product: j.product,
        expectedDuration: j.expected_duration || 1
      }))
    };

    // Helper to format time from minutes
    const formatTime = (minutes) => {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    // Helper to parse time string to minutes
    const parseTime = (timeStr) => {
      if (!timeStr) return null;
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    // Find available technicians for reassignment
    const findAvailableTechnicians = (excludeEmail, date) => {
      return analysisContext.technicians
        .filter(t => t.email !== excludeEmail && t.currentJobCount < t.maxJobs)
        .map(t => ({
          email: t.email,
          name: t.name,
          availableSlots: t.maxJobs - t.currentJobCount,
          currentJobs: t.currentJobCount
        }))
        .sort((a, b) => b.availableSlots - a.availableSlots);
    };

    // Detect scheduling conflicts
    const conflicts = [];
    
    for (const tech of analysisContext.technicians) {
      const techJobs = dateJobs
        .filter(j => j.assigned_to?.includes(tech.email))
        .sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || ''));
      
      // Check for jobs without scheduled times
      const unscheduledJobs = techJobs.filter(j => !j.scheduled_time);
      if (unscheduledJobs.length > 0) {
        for (const job of unscheduledJobs) {
          conflicts.push({
            type: 'missing_time',
            severity: 'medium',
            technician: tech.name,
            technicianEmail: tech.email,
            job: { 
              id: job.id, 
              jobNumber: job.job_number, 
              customer: job.customer_name,
              address: job.address_suburb || job.address_full
            },
            message: `Job #${job.job_number} (${job.customer_name}) is scheduled for ${targetDate} but has no specific time assigned.`,
            suggestedFix: `Set a specific time for Job #${job.job_number} to enable route optimization.`,
            suggestedAction: {
              type: 'set_time',
              jobId: job.id,
              recommendedTimes: ['08:00', '10:00', '13:00', '15:00']
            }
          });
        }
      }

      // Check sequential jobs for conflicts
      const scheduledJobs = techJobs.filter(j => j.scheduled_time);
      
      for (let i = 0; i < scheduledJobs.length - 1; i++) {
        const currentJob = scheduledJobs[i];
        const nextJob = scheduledJobs[i + 1];
        
        const currentDuration = currentJob.expected_duration || 1;
        const currentStartTime = parseTime(currentJob.scheduled_time);
        const currentEndTime = currentStartTime + (currentDuration * 60);
        const nextStartTime = parseTime(nextJob.scheduled_time);
        
        // Calculate travel time and distance
        let travelTime = 15; // Default 15 min buffer
        let distanceKm = null;
        
        if (currentJob.latitude && currentJob.longitude && nextJob.latitude && nextJob.longitude) {
          distanceKm = calculateDistance(
            currentJob.latitude, currentJob.longitude,
            nextJob.latitude, nextJob.longitude
          );
          travelTime = Math.max(estimateTravelTime(distanceKm), 10); // Minimum 10 min buffer
        }
        
        const gapMinutes = nextStartTime - currentEndTime;
        const requiredGap = travelTime;
        
        // Direct time overlap (high severity)
        if (nextStartTime < currentEndTime) {
          const overlapMinutes = currentEndTime - nextStartTime;
          const suggestedNewTime = formatTime(currentEndTime + travelTime);
          
          conflicts.push({
            type: 'overlap',
            severity: 'high',
            technician: tech.name,
            technicianEmail: tech.email,
            job1: { 
              id: currentJob.id, 
              jobNumber: currentJob.job_number, 
              customer: currentJob.customer_name,
              time: currentJob.scheduled_time,
              endTime: formatTime(currentEndTime),
              duration: currentDuration,
              address: currentJob.address_suburb || currentJob.address_full
            },
            job2: { 
              id: nextJob.id, 
              jobNumber: nextJob.job_number, 
              customer: nextJob.customer_name,
              time: nextJob.scheduled_time,
              address: nextJob.address_suburb || nextJob.address_full
            },
            overlapMinutes,
            message: `⚠️ OVERLAP: Job #${currentJob.job_number} ends at ${formatTime(currentEndTime)} but Job #${nextJob.job_number} starts at ${nextJob.scheduled_time} (${overlapMinutes} min overlap).`,
            suggestedFix: `Reschedule Job #${nextJob.job_number} to ${suggestedNewTime} or later.`,
            suggestedAction: {
              type: 'reschedule',
              jobId: nextJob.id,
              currentTime: nextJob.scheduled_time,
              suggestedTime: suggestedNewTime,
              reason: `Allows ${tech.name} to complete Job #${currentJob.job_number} and travel ${distanceKm ? `${Math.round(distanceKm)}km` : ''} to the next location.`
            }
          });
        }
        // Insufficient travel time (medium severity)
        else if (gapMinutes < requiredGap) {
          const shortfall = requiredGap - gapMinutes;
          const suggestedNewTime = formatTime(currentEndTime + requiredGap);
          
          conflicts.push({
            type: 'insufficient_travel',
            severity: 'medium',
            technician: tech.name,
            technicianEmail: tech.email,
            job1: { 
              id: currentJob.id, 
              jobNumber: currentJob.job_number, 
              customer: currentJob.customer_name,
              time: currentJob.scheduled_time,
              endTime: formatTime(currentEndTime),
              address: currentJob.address_suburb || currentJob.address_full
            },
            job2: { 
              id: nextJob.id, 
              jobNumber: nextJob.job_number, 
              customer: nextJob.customer_name,
              time: nextJob.scheduled_time,
              address: nextJob.address_suburb || nextJob.address_full
            },
            gapMinutes,
            requiredGap,
            distanceKm: distanceKm ? Math.round(distanceKm * 10) / 10 : null,
            message: `⏱️ TIGHT SCHEDULE: Only ${gapMinutes} min between jobs, but ${requiredGap} min needed${distanceKm ? ` (${Math.round(distanceKm)}km travel)` : ''}.`,
            suggestedFix: `Move Job #${nextJob.job_number} to ${suggestedNewTime} (+${shortfall} min) to allow adequate travel time.`,
            suggestedAction: {
              type: 'reschedule',
              jobId: nextJob.id,
              currentTime: nextJob.scheduled_time,
              suggestedTime: suggestedNewTime,
              minutesNeeded: shortfall,
              reason: `Need ${shortfall} more minutes for travel${distanceKm ? ` (${Math.round(distanceKm)}km)` : ''} between ${currentJob.address_suburb || 'job 1'} and ${nextJob.address_suburb || 'job 2'}.`
            }
          });
        }
      }
      
      // Check for overloaded technicians
      if (tech.currentJobCount > tech.maxJobs) {
        const excessJobs = tech.currentJobCount - tech.maxJobs;
        const availableTechs = findAvailableTechnicians(tech.email, targetDate);
        
        // Find jobs that could be reassigned (prefer unscheduled or end-of-day jobs)
        const reassignCandidates = techJobs
          .sort((a, b) => {
            // Prioritize jobs without times for reassignment
            if (!a.scheduled_time && b.scheduled_time) return -1;
            if (a.scheduled_time && !b.scheduled_time) return 1;
            // Then by time (later jobs first)
            return (b.scheduled_time || '').localeCompare(a.scheduled_time || '');
          })
          .slice(0, excessJobs)
          .map(j => ({
            id: j.id,
            jobNumber: j.job_number,
            customer: j.customer_name,
            time: j.scheduled_time,
            address: j.address_suburb || j.address_full
          }));

        conflicts.push({
          type: 'overloaded',
          severity: tech.currentJobCount > tech.maxJobs + 2 ? 'high' : 'medium',
          technician: tech.name,
          technicianEmail: tech.email,
          currentJobs: tech.currentJobCount,
          maxJobs: tech.maxJobs,
          excessJobs,
          message: `🔴 OVERLOADED: ${tech.name} has ${tech.currentJobCount} jobs but daily max is ${tech.maxJobs} (${excessJobs} over capacity).`,
          suggestedFix: availableTechs.length > 0 
            ? `Reassign ${excessJobs} job(s) to ${availableTechs.slice(0, 2).map(t => t.name).join(' or ')}.`
            : `Reschedule ${excessJobs} job(s) to another day - no other technicians available.`,
          suggestedAction: {
            type: 'reassign',
            jobsToReassign: reassignCandidates,
            availableTechnicians: availableTechs.slice(0, 3),
            reason: `${tech.name} is at ${Math.round((tech.currentJobCount / tech.maxJobs) * 100)}% capacity.`
          }
        });
      }
      
      // Check for very long workday (more than 10 hours of scheduled work)
      if (scheduledJobs.length >= 2) {
        const firstJob = scheduledJobs[0];
        const lastJob = scheduledJobs[scheduledJobs.length - 1];
        const lastJobDuration = lastJob.expected_duration || 1;
        
        const dayStart = parseTime(firstJob.scheduled_time);
        const dayEnd = parseTime(lastJob.scheduled_time) + (lastJobDuration * 60);
        const workdayHours = (dayEnd - dayStart) / 60;
        
        if (workdayHours > 10) {
          conflicts.push({
            type: 'long_workday',
            severity: workdayHours > 12 ? 'high' : 'low',
            technician: tech.name,
            technicianEmail: tech.email,
            workdayHours: Math.round(workdayHours * 10) / 10,
            startTime: firstJob.scheduled_time,
            endTime: formatTime(dayEnd),
            message: `📅 LONG DAY: ${tech.name}'s workday spans ${Math.round(workdayHours * 10) / 10} hours (${firstJob.scheduled_time} - ${formatTime(dayEnd)}).`,
            suggestedFix: `Consider moving later jobs to another day or reassigning to balance workload.`,
            suggestedAction: {
              type: 'review',
              reason: `Workday exceeds 10 hours which may impact quality and technician wellbeing.`
            }
          });
        }
      }
    }
    
    // Check for double-booked jobs (same job assigned to multiple technicians at same time)
    const jobAssignments = {};
    for (const job of dateJobs) {
      if (job.assigned_to && job.assigned_to.length > 1 && job.scheduled_time) {
        // This might be intentional (team jobs), but flag if job type doesn't typically need multiple techs
        const jobType = (job.job_type_name || job.job_type || '').toLowerCase();
        const teamJobTypes = ['installation', 'install', 'large repair'];
        const isLikelyTeamJob = teamJobTypes.some(t => jobType.includes(t));
        
        if (!isLikelyTeamJob) {
          conflicts.push({
            type: 'multiple_assignment',
            severity: 'low',
            job: {
              id: job.id,
              jobNumber: job.job_number,
              customer: job.customer_name,
              time: job.scheduled_time,
              jobType: job.job_type_name || job.job_type
            },
            assignedTo: job.assigned_to_name || job.assigned_to,
            message: `ℹ️ INFO: Job #${job.job_number} (${job.job_type_name || job.job_type}) has ${job.assigned_to.length} technicians assigned. Verify if this is intentional.`,
            suggestedFix: `If only one technician is needed, remove extra assignments to free up capacity.`,
            suggestedAction: {
              type: 'review',
              reason: `${job.job_type_name || job.job_type} jobs typically only need one technician.`
            }
          });
        }
      }
    }
    
    // Sort conflicts by severity
    const severityOrder = { high: 0, medium: 1, low: 2 };
    conflicts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // Generate job assignment suggestions
    const assignmentSuggestions = [];
    for (const job of analysisContext.unassignedJobs.slice(0, 10)) {
      const candidates = [];
      
      for (const tech of analysisContext.technicians) {
        if (tech.currentJobCount >= tech.maxJobs) continue;
        
        const skillScore = calculateSkillMatch(job, { skills: tech.skills });
        
        // Calculate distance score if coordinates available
        let distanceScore = 0.5;
        if (job.lat && job.lng && tech.homeLat && tech.homeLng) {
          const distance = calculateDistance(tech.homeLat, tech.homeLng, job.lat, job.lng);
          distanceScore = Math.max(0, 1 - (distance / 50)); // Closer = higher score
        }
        
        // Availability score (fewer jobs = higher score)
        const availabilityScore = 1 - (tech.currentJobCount / tech.maxJobs);
        
        const totalScore = (skillScore * 0.4) + (distanceScore * 0.3) + (availabilityScore * 0.3);
        
        candidates.push({
          email: tech.email,
          name: tech.name,
          score: totalScore,
          skillMatch: Math.round(skillScore * 100),
          proximity: Math.round(distanceScore * 100),
          availability: Math.round(availabilityScore * 100),
          currentJobs: tech.currentJobCount,
          maxJobs: tech.maxJobs
        });
      }
      
      candidates.sort((a, b) => b.score - a.score);
      
      if (candidates.length > 0) {
        assignmentSuggestions.push({
          job: {
            id: job.id,
            jobNumber: job.jobNumber,
            customer: job.customer,
            address: job.suburb || job.address,
            jobType: job.jobType,
            product: job.product
          },
          recommendedTechnician: candidates[0],
          alternatives: candidates.slice(1, 3),
          reason: `Best match based on ${candidates[0].skillMatch}% skill match, ${candidates[0].proximity}% proximity, and ${candidates[0].availability}% availability.`
        });
      }
    }

    // Generate optimized routes for each technician
    const optimizedRoutes = [];
    for (const tech of analysisContext.technicians) {
      const techJobs = dateJobs.filter(j => j.assigned_to?.includes(tech.email));
      
      if (techJobs.length === 0) continue;
      
      const startLat = tech.homeLat || -33.8688; // Default to Sydney
      const startLng = tech.homeLng || 151.2093;
      
      const optimized = optimizeRoute(techJobs, startLat, startLng);
      
      let totalDistance = 0;
      let totalTravelTime = 0;
      const routeStops = [];
      let suggestedStartTime = 7 * 60; // 7:00 AM in minutes
      
      for (let i = 0; i < optimized.length; i++) {
        const job = optimized[i];
        totalDistance += job.distanceFromPrevious || 0;
        totalTravelTime += job.travelTimeFromPrevious || 0;
        
        const arrivalTime = suggestedStartTime + totalTravelTime;
        const arrivalHours = Math.floor(arrivalTime / 60);
        const arrivalMins = arrivalTime % 60;
        
        routeStops.push({
          order: i + 1,
          jobId: job.id,
          jobNumber: job.job_number,
          customer: job.customer_name,
          address: job.address_suburb || job.address_full,
          currentTime: job.scheduled_time,
          suggestedTime: `${String(arrivalHours).padStart(2, '0')}:${String(arrivalMins).padStart(2, '0')}`,
          travelTimeFromPrevious: job.travelTimeFromPrevious || 0,
          distanceFromPrevious: Math.round((job.distanceFromPrevious || 0) * 10) / 10
        });
        
        // Add job duration for next calculation
        suggestedStartTime = arrivalTime + ((job.expected_duration || 1) * 60);
      }
      
      optimizedRoutes.push({
        technician: {
          email: tech.email,
          name: tech.name
        },
        jobCount: optimized.length,
        totalDistanceKm: Math.round(totalDistance * 10) / 10,
        totalTravelTimeMinutes: totalTravelTime,
        route: routeStops,
        estimatedEndTime: routeStops.length > 0 
          ? routeStops[routeStops.length - 1].suggestedTime 
          : null
      });
    }

    // Use AI to generate natural language summary and additional insights
    let aiSummary = null;
    try {
      const aiResponse = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a scheduling assistant for a field service company. Analyze this scheduling data and provide brief, actionable insights.

Date: ${targetDate}
Technicians: ${analysisContext.technicians.length} active
Scheduled Jobs: ${dateJobs.length}
Unassigned Jobs: ${unassignedJobs.length}
Conflicts Detected: ${conflicts.length}

Conflicts:
${conflicts.map(c => `- ${c.message}`).join('\n') || 'None'}

Top Assignment Suggestions:
${assignmentSuggestions.slice(0, 3).map(s => `- Job #${s.job.jobNumber} (${s.job.jobType}) → ${s.recommendedTechnician.name}`).join('\n') || 'None'}

Provide a brief 2-3 sentence summary of the scheduling situation and top priority actions. Be concise and practical.`,
        response_json_schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            priorityActions: { 
              type: "array", 
              items: { type: "string" }
            },
            overallHealth: {
              type: "string",
              enum: ["good", "needs_attention", "critical"]
            }
          }
        }
      });
      aiSummary = aiResponse;
    } catch (error) {
      console.error('AI summary error:', error);
    }

    return Response.json({
      success: true,
      date: targetDate,
      summary: aiSummary,
      stats: {
        totalTechnicians: analysisContext.technicians.length,
        scheduledJobs: dateJobs.length,
        unassignedJobs: unassignedJobs.length,
        conflictsDetected: conflicts.length
      },
      conflicts,
      assignmentSuggestions,
      optimizedRoutes
    });

  } catch (error) {
    console.error('AI Scheduling Assistant error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});