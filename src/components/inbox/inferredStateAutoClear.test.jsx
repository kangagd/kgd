/**
 * inferredStateAutoClear.test.js - Unit tests for auto-clear logic
 */

import { computeInferredStateWithAutoClear, WAITING_AUTO_CLEAR_DAYS } from './inferredStateAutoClear';

describe('inferredStateAutoClear', () => {
  const now = new Date();
  const getDateDaysAgo = (days) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d.toISOString();
  };

  describe('waiting_on_customer auto-clear', () => {
    test('stays waiting_on_customer if lastInternalMessageAt < 14 days ago', () => {
      const thread = {
        userStatus: null,
        inferredState: 'waiting_on_customer',
        lastInternalMessageAt: getDateDaysAgo(7) // 7 days ago
      };

      const result = computeInferredStateWithAutoClear(thread);
      expect(result).toBe('waiting_on_customer');
    });

    test('auto-clears to none if lastInternalMessageAt = 14 days ago (boundary)', () => {
      const thread = {
        userStatus: null,
        inferredState: 'waiting_on_customer',
        lastInternalMessageAt: getDateDaysAgo(14) // exactly 14 days ago
      };

      const result = computeInferredStateWithAutoClear(thread);
      expect(result).toBe('none');
    });

    test('auto-clears to none if lastInternalMessageAt > 14 days ago', () => {
      const thread = {
        userStatus: null,
        inferredState: 'waiting_on_customer',
        lastInternalMessageAt: getDateDaysAgo(15) // 15 days ago
      };

      const result = computeInferredStateWithAutoClear(thread);
      expect(result).toBe('none');
    });

    test('stays waiting_on_customer if lastInternalMessageAt is missing', () => {
      const thread = {
        userStatus: null,
        inferredState: 'waiting_on_customer',
        lastInternalMessageAt: null
      };

      const result = computeInferredStateWithAutoClear(thread);
      expect(result).toBe('waiting_on_customer');
    });
  });

  describe('needs_reply never auto-clears', () => {
    test('stays needs_reply regardless of time', () => {
      const thread = {
        userStatus: null,
        inferredState: 'needs_reply',
        lastExternalMessageAt: getDateDaysAgo(30) // even very old external message
      };

      const result = computeInferredStateWithAutoClear(thread);
      expect(result).toBe('needs_reply');
    });
  });

  describe('closed threads', () => {
    test('returns none if userStatus === closed', () => {
      const thread = {
        userStatus: 'closed',
        inferredState: 'waiting_on_customer',
        lastInternalMessageAt: getDateDaysAgo(5)
      };

      const result = computeInferredStateWithAutoClear(thread);
      expect(result).toBe('none');
    });
  });

  describe('no-state threads', () => {
    test('stays none if inferredState is none', () => {
      const thread = {
        userStatus: null,
        inferredState: 'none',
        lastInternalMessageAt: getDateDaysAgo(5)
      };

      const result = computeInferredStateWithAutoClear(thread);
      expect(result).toBe('none');
    });

    test('handles null thread', () => {
      const result = computeInferredStateWithAutoClear(null);
      expect(result).toBe('none');
    });
  });
});