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
        name: t.full_name || t.display_name,
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

    // Detect scheduling conflicts
    const conflicts = [];
    for (const tech of analysisContext.technicians) {
      const techJobs = dateJobs
        .filter(j => j.assigned_to?.includes(tech.email))
        .sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || ''));
      
      for (let i = 0; i < techJobs.length - 1; i++) {
        const currentJob = techJobs[i];
        const nextJob = techJobs[i + 1];
        
        if (!currentJob.scheduled_time || !nextJob.scheduled_time) continue;
        
        const currentDuration = currentJob.expected_duration || 1;
        const [currentHours, currentMins] = currentJob.scheduled_time.split(':').map(Number);
        const currentEndTime = currentHours * 60 + currentMins + (currentDuration * 60);
        
        const [nextHours, nextMins] = nextJob.scheduled_time.split(':').map(Number);
        const nextStartTime = nextHours * 60 + nextMins;
        
        // Calculate travel time if coordinates available
        let travelTime = 15; // Default 15 min buffer
        if (currentJob.latitude && currentJob.longitude && nextJob.latitude && nextJob.longitude) {
          const distance = calculateDistance(
            currentJob.latitude, currentJob.longitude,
            nextJob.latitude, nextJob.longitude
          );
          travelTime = estimateTravelTime(distance);
        }
        
        const gapMinutes = nextStartTime - currentEndTime;
        
        if (gapMinutes < travelTime) {
          conflicts.push({
            type: 'travel_time',
            severity: gapMinutes < 0 ? 'high' : 'medium',
            technician: tech.name,
            technicianEmail: tech.email,
            job1: { id: currentJob.id, jobNumber: currentJob.job_number, time: currentJob.scheduled_time },
            job2: { id: nextJob.id, jobNumber: nextJob.job_number, time: nextJob.scheduled_time },
            message: gapMinutes < 0 
              ? `Jobs overlap! Job #${currentJob.job_number} ends after Job #${nextJob.job_number} starts.`
              : `Only ${gapMinutes} min gap between jobs, but ${travelTime} min travel time needed.`,
            suggestedFix: `Consider rescheduling Job #${nextJob.job_number} to start at least ${travelTime} minutes after Job #${currentJob.job_number} ends.`
          });
        }
      }
      
      // Check for overloaded technicians
      if (tech.currentJobCount > tech.maxJobs) {
        conflicts.push({
          type: 'overloaded',
          severity: 'medium',
          technician: tech.name,
          technicianEmail: tech.email,
          message: `${tech.name} has ${tech.currentJobCount} jobs assigned but max is ${tech.maxJobs}.`,
          suggestedFix: `Reassign some jobs to other available technicians.`
        });
      }
    }

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