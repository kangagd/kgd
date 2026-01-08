/**
 * BASE44 SDK - Single Source of Truth
 * 
 * ALL backend functions MUST import from this file instead of directly from npm.
 * This ensures consistent SDK version across the entire application.
 * 
 * Current Version: 0.8.6
 * Last Updated: 2026-01-08
 */

export { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

export const SDK_VERSION = '0.8.6';