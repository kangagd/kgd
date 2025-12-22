import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import RichTextField from "../common/RichTextField";

export default function ProjectSummaryZone({ 
  description, 
  notes, 
  onDescriptionChange, 
  onNotesChange,
  onDescriptionBlur,
  onNotesBlur
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border border-[#E5E7EB] shadow-sm rounded-lg overflow-hidden">
        <CollapsibleTrigger className="w-full">
          <div className="bg-white px-4 py-3 border-b border-[#E5E7EB] flex flex-row items-center justify-between hover:bg-[#F9FAFB] transition-colors">
            <h3 className="text-[16px] font-semibold text-[#111827] leading-[1.2]">Project Summary</h3>
            <ChevronDown className={`w-4 h-4 text-[#6B7280] transition-transform ${open ? 'transform rotate-180' : ''}`} />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-4 space-y-4">
            <div>
              <RichTextField
                label="Description"
                value={description}
                onChange={onDescriptionChange}
                onBlur={onDescriptionBlur}
                placeholder="Add a clear summary of this project…"
              />
            </div>

            <div>
              <RichTextField
                label="Internal Notes"
                value={notes}
                onChange={onNotesChange}
                onBlur={onNotesBlur}
                placeholder="Add any extra notes or context for the team…"
                helperText="Internal only"
              />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}