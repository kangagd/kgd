import React, { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

/**
 * CollapsibleSection - Reusable collapsible container
 * 
 * @param {string} title - Section title
 * @param {boolean} defaultCollapsed - Initial collapsed state (default: false)
 * @param {React.ReactNode} children - Content to show when expanded
 */
export default function CollapsibleSection({ title, defaultCollapsed = false, children }) {
  const [isOpen, setIsOpen] = useState(!defaultCollapsed);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="px-4 py-2.5 flex items-center justify-between hover:bg-[#F9FAFB] transition-colors">
          <h3 className="text-[14px] font-semibold text-[#111827]">{title}</h3>
          <ChevronDown className={`w-4 h-4 text-[#6B7280] transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 pb-3 pt-1 border-t border-[#E5E7EB]">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}