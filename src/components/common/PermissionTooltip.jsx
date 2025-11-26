import React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Lock } from "lucide-react";

/**
 * Wraps a button/element with a tooltip explaining missing permissions
 * When disabled, shows lock icon and tooltip message
 */
export default function PermissionTooltip({ 
  children, 
  hasPermission, 
  message = "You do not have permission to perform this action." 
}) {
  if (hasPermission) {
    return children;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative inline-flex">
            {React.cloneElement(children, { 
              disabled: true,
              className: `${children.props.className || ''} opacity-50 cursor-not-allowed`
            })}
            <Lock className="absolute -top-1 -right-1 w-3 h-3 text-[#6B7280]" />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-[13px]">{message}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}