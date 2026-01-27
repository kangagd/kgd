/**
 * Job-type specific prompt blocks that force the LLM into the right lens.
 * Each block emphasizes what matters for that job type.
 */

const JOB_TYPE_PROMPTS = {
  install: `
JOB TYPE RULES (INSTALL - MANDATORY):
- Translate scope into a clear onsite execution checklist.
- Prioritize: access constraints, install method, safety, required parts, finishing details.
- Call out: site readiness, obstructions, power, clearances, structural fixing points, disposal requirements.
- Include a punch list: photos required, testing steps, handover steps.
- Commercial risk: if deposit/payment not satisfied, clearly instruct HOLD + call office.
  `,

  measure: `
JOB TYPE RULES (MEASURE / SITE VISIT - MANDATORY):
- This is not an install. The goal is to confirm unknowns and remove quote risk.
- Output must be a measurement + decision checklist: openings, headroom/sideroom, levels, power, access, hazards.
- Identify blockers that prevent quoting/ordering.
- Include required photos list and "questions to ask customer onsite".
- End with: "What we need to finalise next steps" (e.g., final quote revision, parts list, scheduling).
  `,

  service: `
JOB TYPE RULES (REPAIR / SERVICE - MANDATORY):
- Summarise the fault symptoms and history from visits + emails.
- Provide a diagnostic checklist first, then likely fixes.
- Flag safety risks (springs/cables/motor limits) and when to stop and escalate.
- Identify parts that might be needed and whether this is likely same-day fix vs quote-required.
- Include customer expectation management notes if present (noise, intermittent issues, prior attempts).
  `,

  logistics: `
JOB TYPE RULES (LOGISTICS - MANDATORY):
- Provide a step-by-step pickup/drop plan: locations, time constraints, contact person, reference numbers.
- List items/quantities explicitly and handling notes (fragile, long lengths, two-person lift).
- Include loading bay → storage → vehicle instructions if relevant.
- Include proof requirements: photos, signatures, delivery docket.
  `,

  warranty: `
JOB TYPE RULES (WARRANTY / DEFECT - MANDATORY):
- Summarise original install + reported defect + timeline.
- Provide an evidence checklist: photos, videos, measurements, serial numbers, installation conditions.
- Clarify exclusions if known (e.g., oil canning note where applicable).
- Provide a decision tree: adjust/repair now vs document and escalate to supplier vs quoteable works.
  `,

  general: `
JOB TYPE RULES (GENERAL - MANDATORY):
- Prioritise what the technician must do today, known constraints, and risks.
- Keep it concise and actionable.
- Highlight any uncertainties that need clarification before proceeding.
  `
};

/**
 * Get the appropriate job-type prompt block based on job_type_name
 * Falls back to 'general' if type doesn't match
 */
export function getJobTypePromptBlock(jobTypeName) {
  if (!jobTypeName) return JOB_TYPE_PROMPTS.general;
  
  const normalized = jobTypeName.toLowerCase().trim();
  
  // Map variations to keys
  if (normalized.includes('install')) return JOB_TYPE_PROMPTS.install;
  if (normalized.includes('measure') || normalized.includes('site visit')) return JOB_TYPE_PROMPTS.measure;
  if (normalized.includes('repair') || normalized.includes('service')) return JOB_TYPE_PROMPTS.service;
  if (normalized.includes('logistics')) return JOB_TYPE_PROMPTS.logistics;
  if (normalized.includes('warranty') || normalized.includes('defect')) return JOB_TYPE_PROMPTS.warranty;
  
  return JOB_TYPE_PROMPTS.general;
}