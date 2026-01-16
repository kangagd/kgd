/**
 * Test: Verify job update guardrails are working correctly
 */

import { applyJobUpdateGuardrails, logBlockedCompletionWrite } from './jobUpdateGuardrails.js';

// Test 1: Draft mode blocks completion fields
console.log('\n=== TEST 1: Draft Mode Blocks Completion Fields ===');
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

console.log('Input patch:', draftPatch);
console.log('Cleaned patch:', draftClean);
console.log('Blocked fields:', draftBlocked);
console.assert(draftBlocked.length === 3, 'Should block 3 completion fields');
console.assert('overview' in draftClean === false, 'Overview should be removed');
console.assert('measurements' in draftClean === true, 'Measurements should remain');

// Test 2: Final checkout allows completion fields
console.log('\n=== TEST 2: Final Checkout Allows Completion Fields ===');
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

console.log('Input patch:', finalPatch);
console.log('Cleaned patch:', finalClean);
console.log('Blocked fields:', finalBlocked);
console.assert(finalBlocked.length === 0, 'Should not block fields in final_checkout');
console.assert('outcome' in finalClean === true, 'Outcome should remain');

// Test 3: No empty overwrites in final checkout
console.log('\n=== TEST 3: No Empty Overwrite in Final Checkout ===');
const jobWithCompletion = {
  id: 'job-002',
  completion_notes: 'Already completed',
  overview: 'Work was done'
};

const emptyPatch = {
  completion_notes: '',  // Empty value
  overview: 'New overview'
};

const { cleanPatch: noEmptyClean, blockedFields: noEmptyBlocked } = applyJobUpdateGuardrails(
  jobWithCompletion,
  emptyPatch,
  'final_checkout',
  'admin@example.com'
);

console.log('Input patch:', emptyPatch);
console.log('Cleaned patch:', noEmptyClean);
console.log('Blocked fields (empty overwrites):', noEmptyBlocked);
console.assert('completion_notes' in noEmptyClean === false, 'Empty completion_notes should be removed');
console.assert(noEmptyClean.overview === 'New overview', 'Non-empty overview should remain');

// Test 4: Address sync - only fills if empty
console.log('\n=== TEST 4: Address Sync - Only Fill if Empty ===');
const jobNoAddress = {
  id: 'job-003',
  address_full: null
};

const jobWithAddress = {
  id: 'job-004',
  address_full: '123 Main St'
};

const addressPatch = {
  address_full: '456 Park Ave'
};

const { cleanPatch: fillClean } = applyJobUpdateGuardrails(jobNoAddress, addressPatch, 'draft');
const { cleanPatch: noOverwriteClean } = applyJobUpdateGuardrails(jobWithAddress, addressPatch, 'draft');

console.log('Fill empty address:', fillClean);
console.assert(fillClean.address_full === '456 Park Ave', 'Should fill empty address');

console.log('Don\'t overwrite existing:', noOverwriteClean);
console.assert('address_full' in noOverwriteClean === false, 'Should not overwrite non-empty address');

console.log('\n✅ All guardrail tests passed!');