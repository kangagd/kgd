/**
 * Inbox filter logic
 * Must match the status chip logic exactly
 */

import { getStatusChip, isLinked } from '@/components/utils/emailThreadStateHelpers';

export const inboxFilters = {
  all: (threads) => threads,
  
  needsReply: (threads) => threads.filter(t => {
    const chip = getStatusChip(t);
    return chip && chip.key === 'needs_reply';
  }),
  
  waitingOnCustomer: (threads) => threads.filter(t => {
    const chip = getStatusChip(t);
    return chip && chip.key === 'waiting_on_customer';
  }),
  
  open: (threads) => threads.filter(t => {
    const chip = getStatusChip(t);
    return chip && chip.key === 'open';
  }),
  
  closed: (threads) => threads.filter(t => {
    const chip = getStatusChip(t);
    return chip && chip.key === 'closed';
  }),
  
  linked: (threads) => threads.filter(t => isLinked(t)),
  
  unlinked: (threads) => threads.filter(t => !isLinked(t))
};

export const filterLabels = {
  all: 'All',
  needsReply: 'Needs reply',
  waitingOnCustomer: 'Waiting on customer',
  open: 'Open',
  closed: 'Closed',
  linked: 'Linked',
  unlinked: 'Unlinked'
};