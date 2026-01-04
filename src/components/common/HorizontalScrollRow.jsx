import React from "react";
import { cn } from "@/lib/utils";

/**
 * HorizontalScrollRow - Prevents page-level horizontal overflow
 * 
 * Wraps content that may exceed viewport width (filters, tabs, chips, buttons)
 * and makes it scrollable within its own container instead of causing body overflow.
 * 
 * Usage:
 * <HorizontalScrollRow>
 *   <div className="flex gap-2">
 *     {manyChips.map(...)}
 *   </div>
 * </HorizontalScrollRow>
 */
export default function HorizontalScrollRow({ 
  children, 
  className = "", 
  innerClassName = "",
  showScrollbar = false 
}) {
  return (
    <div 
      className={cn(
        "max-w-full overflow-x-auto",
        showScrollbar ? "scrollbar" : "scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent",
        className
      )}
    >
      <div className={cn("min-w-max w-full", innerClassName)}>
        {children}
      </div>
    </div>
  );
}