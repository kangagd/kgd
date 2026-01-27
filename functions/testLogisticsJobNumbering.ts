import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getPurposeCode, buildLogisticsJobNumber, isLogisticsJobNumber, getNextSequence } from './shared/logisticsJobNumbering.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const tests = [];
    let passed = 0;
    let failed = 0;

    // Test 1: Purpose code mapping
    const test1 = getPurposeCode('po_pickup_from_supplier') === 'PO-PU';
    tests.push({
      name: 'Purpose code for PO pickup',
      passed: test1,
      expected: 'PO-PU',
      actual: getPurposeCode('po_pickup_from_supplier')
    });
    test1 ? passed++ : failed++;

    // Test 2: Purpose code for delivery
    const test2 = getPurposeCode('po_delivery_to_warehouse') === 'PO-DEL';
    tests.push({
      name: 'Purpose code for PO delivery',
      passed: test2,
      expected: 'PO-DEL',
      actual: getPurposeCode('po_delivery_to_warehouse')
    });
    test2 ? passed++ : failed++;

    // Test 3: Sample dropoff
    const test3 = getPurposeCode('sample_dropoff') === 'SAMP-DO';
    tests.push({
      name: 'Purpose code for sample dropoff',
      passed: test3,
      expected: 'SAMP-DO',
      actual: getPurposeCode('sample_dropoff')
    });
    test3 ? passed++ : failed++;

    // Test 4: Sample pickup
    const test4 = getPurposeCode('sample_pickup') === 'SAMP-PU';
    tests.push({
      name: 'Purpose code for sample pickup',
      passed: test4,
      expected: 'SAMP-PU',
      actual: getPurposeCode('sample_pickup')
    });
    test4 ? passed++ : failed++;

    // Test 5: Unknown purpose fallback
    const test5 = getPurposeCode('unknown_purpose') === 'LOG';
    tests.push({
      name: 'Unknown purpose fallback',
      passed: test5,
      expected: 'LOG',
      actual: getPurposeCode('unknown_purpose')
    });
    test5 ? passed++ : failed++;

    // Test 6: First job for project (no suffix)
    const jobNum1 = buildLogisticsJobNumber({
      projectNumber: '1234',
      purposeCode: 'PO-PU',
      sequence: 1
    });
    const test6 = jobNum1 === '1234-PO-PU';
    tests.push({
      name: 'First job for project (no suffix)',
      passed: test6,
      expected: '1234-PO-PU',
      actual: jobNum1
    });
    test6 ? passed++ : failed++;

    // Test 7: Second job for same project + purpose
    const jobNum2 = buildLogisticsJobNumber({
      projectNumber: '1234',
      purposeCode: 'PO-PU',
      sequence: 2
    });
    const test7 = jobNum2 === '1234-PO-PU-2';
    tests.push({
      name: 'Second job for same project + purpose',
      passed: test7,
      expected: '1234-PO-PU-2',
      actual: jobNum2
    });
    test7 ? passed++ : failed++;

    // Test 8: Different purpose same project
    const jobNum3 = buildLogisticsJobNumber({
      projectNumber: '1234',
      purposeCode: 'PO-DEL',
      sequence: 1
    });
    const test8 = jobNum3 === '1234-PO-DEL';
    tests.push({
      name: 'Different purpose same project (no suffix)',
      passed: test8,
      expected: '1234-PO-DEL',
      actual: jobNum3
    });
    test8 ? passed++ : failed++;

    // Test 9: No project fallback
    const jobNum4 = buildLogisticsJobNumber({
      projectNumber: null,
      purposeCode: 'SAMP-DO',
      fallbackShortId: 'abc123'
    });
    const test9 = jobNum4 === 'LOG-SAMP-DO-abc123';
    tests.push({
      name: 'No project fallback format',
      passed: test9,
      expected: 'LOG-SAMP-DO-abc123',
      actual: jobNum4
    });
    test9 ? passed++ : failed++;

    // Test 10: Pattern detection
    const test10a = isLogisticsJobNumber('1234-PO-PU');
    const test10b = isLogisticsJobNumber('1234-PO-PU-2');
    const test10c = isLogisticsJobNumber('LOG-SAMP-DO-abc123');
    const test10d = !isLogisticsJobNumber('5041-A'); // Should NOT match A/B/C pattern
    const test10 = test10a && test10b && test10c && test10d;
    tests.push({
      name: 'Pattern detection (rejects A/B/C suffix)',
      passed: test10,
      details: { test10a, test10b, test10c, test10d }
    });
    test10 ? passed++ : failed++;

    // Test 11: Sequence calculation
    const mockJobs = [
      { job_number: '1234-PO-PU' },
      { job_number: '1234-PO-PU-2' },
      { job_number: '1234-PO-DEL' }
    ];
    const nextSeq = getNextSequence(mockJobs, '1234', 'PO-PU');
    const test11 = nextSeq === 3;
    tests.push({
      name: 'Sequence calculation (should be 3)',
      passed: test11,
      expected: 3,
      actual: nextSeq
    });
    test11 ? passed++ : failed++;

    // Test 12: Idempotency check
    const jobNum5a = buildLogisticsJobNumber({
      projectNumber: '5000',
      purposeCode: 'SAMP-DO',
      sequence: 1
    });
    const jobNum5b = buildLogisticsJobNumber({
      projectNumber: '5000',
      purposeCode: 'SAMP-DO',
      sequence: 1
    });
    const test12 = jobNum5a === jobNum5b;
    tests.push({
      name: 'Idempotency (same inputs = same output)',
      passed: test12,
      expected: 'Same',
      actual: jobNum5a === jobNum5b ? 'Same' : 'Different'
    });
    test12 ? passed++ : failed++;

    return Response.json({
      success: true,
      summary: {
        total: tests.length,
        passed,
        failed
      },
      tests
    });

  } catch (error) {
    console.error('Test error:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});