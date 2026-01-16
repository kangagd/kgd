/**
 * Standalone test function to verify job guardrails
 * Call via: base44.functions.invoke('testJobGuardrails', {})
 */

import { applyJobUpdateGuardrails } from './shared/jobUpdateGuardrails.js';

export async function testJobGuardrails(payload) {
  const results = [];

  // Test 1: Draft mode blocks completion fields
  const existingJob = {
    id: 'job-001',
    measurements: { width: '100cm' },
    outcome: null,
    overview: null,
    completion_notes: null
  };

  const draftPatch = {
    measurements: { height: '80cm' },
    overview: 'Work completed',
    outcome: 'completed',
    completion_notes: 'All done'
  };

  const { cleanPatch: draftClean, blockedFields: draftBlocked } = applyJobUpdateGuardrails(
    existingJob,
    draftPatch,
    'draft',
    'tech@example.com'
  );

  results.push({
    test: 'Draft mode blocks completion fields',
    passed: draftBlocked.length === 3 && !('overview' in draftClean) && ('measurements' in draftClean),
    details: { blockedFields: draftBlocked, cleanPatch: draftClean }
  });

  // Test 2: Final checkout allows completion fields
  const finalPatch = {
    outcome: 'completed',
    overview: 'Work done',
    completion_notes: 'Finished'
  };

  const { cleanPatch: finalClean, blockedFields: finalBlocked } = applyJobUpdateGuardrails(
    existingJob,
    finalPatch,
    'final_checkout',
    'tech@example.com'
  );

  results.push({
    test: 'Final checkout allows completion fields',
    passed: finalBlocked.length === 0 && ('outcome' in finalClean),
    details: { blockedFields: finalBlocked, cleanPatch: finalClean }
  });

  // Test 3: No empty overwrites in final checkout
  const jobWithCompletion = {
    id: 'job-002',
    completion_notes: 'Already completed',
    overview: 'Work was done'
  };

  const emptyPatch = {
    completion_notes: '',
    overview: 'New overview'
  };

  const { cleanPatch: noEmptyClean } = applyJobUpdateGuardrails(
    jobWithCompletion,
    emptyPatch,
    'final_checkout',
    'admin@example.com'
  );

  results.push({
    test: 'No empty overwrites in final checkout',
    passed: !('completion_notes' in noEmptyClean) && noEmptyClean.overview === 'New overview',
    details: { cleanPatch: noEmptyClean }
  });

  // Test 4: Address sync only fills if empty
  const jobNoAddress = { id: 'job-003', address_full: null };
  const jobWithAddress = { id: 'job-004', address_full: '123 Main St' };
  const addressPatch = { address_full: '456 Park Ave' };

  const { cleanPatch: fillClean } = applyJobUpdateGuardrails(jobNoAddress, addressPatch, 'draft');
  const { cleanPatch: noOverwriteClean } = applyJobUpdateGuardrails(jobWithAddress, addressPatch, 'draft');

  results.push({
    test: 'Address sync fills empty',
    passed: fillClean.address_full === '456 Park Ave',
    details: { cleanPatch: fillClean }
  });

  results.push({
    test: 'Address sync does not overwrite non-empty',
    passed: !('address_full' in noOverwriteClean),
    details: { cleanPatch: noOverwriteClean }
  });

  const allPassed = results.every(r => r.passed);

  return {
    success: allPassed,
    summary: `${results.filter(r => r.passed).length}/${results.length} tests passed`,
    results
  };
}

Deno.serve(async (req) => {
  try {
    const result = await testJobGuardrails({});
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});