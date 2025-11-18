import React from "react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, User, FileText, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";

const outcomeColors = {
  new_quote: "bg-purple-100 text-purple-800 border-purple-200",
  update_quote: "bg-indigo-100 text-indigo-800 border-indigo-200",
  send_invoice: "bg-[#FEF8C8] text-slate-800 border-slate-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  return_visit_required: "bg-amber-100 text-amber-800 border-amber-200"
};

export default function JobVisitCard({ jobSummaries, jobImages }) {
  if (!jobSummaries || jobSummaries.length === 0) {
    return null;
  }

  return (
    <Collapsible defaultOpen={false} className="mt-3 pt-3 border-t border-slate-200">
      <CollapsibleTrigger className="flex items-center justify-between w-full group bg-slate-50 border border-slate-200 rounded-lg p-2.5 hover:bg-slate-100 transition-colors">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-slate-600" />
          <span className="text-sm font-bold text-slate-900">Visit Summaries ({jobSummaries.length})</span>
        </div>
        <ChevronDown className="w-4 h-4 text-slate-500 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      
      <CollapsibleContent className="pt-2.5 space-y-2.5">
        {jobSummaries.map((summary) => (
          <div key={summary.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-900 text-sm">{summary.technician_name}</span>
              <span className="text-xs text-slate-500">
                {format(new Date(summary.checkout_time), 'MMM d, yyyy h:mm a')}
              </span>
            </div>
            
            {summary.outcome && (
              <Badge className={`${outcomeColors[summary.outcome]} mb-2 font-semibold border text-xs`}>
                {summary.outcome.replace(/_/g, ' ')}
              </Badge>
            )}

            <div className="space-y-2 text-sm">
              {summary.overview && (
                <div>
                  <div className="text-xs font-bold text-slate-600 mb-0.5">Overview:</div>
                  <div className="text-slate-700" dangerouslySetInnerHTML={{ __html: summary.overview }} />
                </div>
              )}
              
              {summary.next_steps && (
                <div>
                  <div className="text-xs font-bold text-slate-600 mb-0.5">Next Steps:</div>
                  <div className="text-slate-700" dangerouslySetInnerHTML={{ __html: summary.next_steps }} />
                </div>
              )}
              
              {summary.communication_with_client && (
                <div>
                  <div className="text-xs font-bold text-slate-600 mb-0.5">Communication:</div>
                  <div className="text-slate-700" dangerouslySetInnerHTML={{ __html: summary.communication_with_client }} />
                </div>
              )}
            </div>
          </div>
        ))}

        {jobImages && jobImages.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <ImageIcon className="w-4 h-4 text-slate-600" />
              <span className="text-sm font-bold text-slate-900">Job Photos ({jobImages.length})</span>
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
                    alt={`Job image ${index + 1}`} 
                    className="w-full h-20 object-cover rounded border border-slate-200 hover:border-[#fae008] transition-all"
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