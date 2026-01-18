import React from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function ProjectTagsDisplay({ tags = [] }) {
  if (!tags || tags.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map(tag => {
        const TagBadge = (
          <Badge
            key={tag.id}
            style={{ backgroundColor: tag.color }}
            className="text-white font-medium text-[11px] px-2 py-0.5"
          >
            {tag.name}
          </Badge>
        );

        if (tag.description) {
          return (
            <TooltipProvider key={tag.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  {TagBadge}
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-[12px]">{tag.description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }

        return TagBadge;
      })}
    </div>
  );
}