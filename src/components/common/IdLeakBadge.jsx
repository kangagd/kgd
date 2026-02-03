import React from 'react';
import { isIdLike, logIdLeak, DEBUG_SHOW_RAW_IDS } from '@/components/utils/idLeakDebug';
import { Badge } from '@/components/ui/badge';

/**
 * Wraps rendered labels and shows a red ID LEAK badge if the label is actually an ID
 * Only visible to admins when DEBUG_SHOW_RAW_IDS is enabled
 * 
 * Usage:
 * <IdLeakBadge value={projectLabel} componentName="ProjectCard" fieldName="project_title">
 *   {projectLabel}
 * </IdLeakBadge>
 */
export default function IdLeakBadge({
  children,
  value,
  componentName = 'Unknown',
  fieldName = 'field',
  isAdmin = false
}) {
  const isLeak = isIdLike(value);

  // Log leak in console (will show in dev tools)
  if (isLeak && DEBUG_SHOW_RAW_IDS && isAdmin) {
    logIdLeak(componentName, fieldName, value);
  }

  // Show red badge only to admins when debug mode is on
  if (isLeak && DEBUG_SHOW_RAW_IDS && isAdmin) {
    return (
      <span className="inline-flex items-center gap-1">
        {children}
        <Badge variant="error" className="text-[10px] py-0 px-1.5">
          ID LEAK
        </Badge>
      </span>
    );
  }

  // Normal rendering when debug is off
  return <>{children}</>;
}