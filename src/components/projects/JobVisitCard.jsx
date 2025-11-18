import React from "react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Clock, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";

const outcomeColors = {
  new_quote: "bg-purple-500/10 text-purple-800 border-purple-500/20",
  update_quote: "bg-indigo-500/10 text-indigo-800 border-indigo-500/20",
  send_invoice: "bg-yellow-500/10 text-yellow-800 border-yellow-500/20",
  completed: "bg-green-500/10 text-green-800 border-green-500/20",
  return_visit_required: "bg-amber-500/10 text-amber-800 border-amber-500/20"
};

export default function JobVisitCard({ jobSummaries, jobImages }) {
  if (!jobSummaries || jobSummaries.length === 0) {
    return null;
  }

  return (
    <Collapsible defaultOpen={false} className="mt-2 pt-2 border-t border-slate-200">
      <CollapsibleTrigger className="flex items-center justify-between w-full py-1.5 hover:bg-slate-200/50 rounded transition-colors px-2 -mx-2">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs font-medium text-slate-600 uppercase tracking-wide">Visits ({jobSummaries.length})</span>
        </div>
        <ChevronDown className="w-4 h-4 text-slate-400 transition-transform data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      
      <CollapsibleContent className="pt-2 space-y-2">
        {jobSummaries.map((summary) => (
          <div key={summary.id} className="bg-white border border-slate-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-900">{summary.technician_name}</span>
              <span className="text-xs text-slate-500">
                {format(new Date(summary.checkout_time), 'MMM d, h:mm a')}
              </span>
            </div>
            
            {summary.outcome && (
              <Badge className={`${outcomeColors[summary.outcome]} rounded-full px-2.5 py-0.5 text-xs font-medium border mb-2`}>
                {summary.outcome.replace(/_/g, ' ')}
              </Badge>
            )}

            <div className="space-y-2 text-sm">
              {summary.overview && (
                <div>
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Overview</div>
                  <div className="text-slate-700 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: summary.overview }} />
                </div>
              )}
              
              {summary.next_steps && (
                <div>
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Next Steps</div>
                  <div className="text-slate-700 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: summary.next_steps }} />
                </div>
              )}
              
              {summary.communication_with_client && (
                <div>
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Communication</div>
                  <div className="text-slate-700 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: summary.communication_with_client }} />
                </div>
              )}
            </div>
          </div>
        ))}

        {jobImages && jobImages.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-medium text-slate-600 uppercase tracking-wide">Photos ({jobImages.length})</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {jobImages.map((url, index) => (
                <a 
                  key={index} 
                  href={url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block"
                >
                  <img 
                    src={url} 
                    alt={`Job ${index + 1}`} 
                    className="w-full h-16 object-cover rounded border border-slate-200 hover:border-slate-400 transition-all"
                  />
                </a>
              ))}
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}