import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckCircle2, Circle, Phone, Mail, User, AlertCircle } from "lucide-react";

const tradeTypeIcons = {
  "Electrician": "⚡",
  "Gate Installer": "🚪",
  "Post Installer / Fabricator": "🔧",
  "Concreter": "🏗️",
  "Builder's Installer": "👷",
  "Other": "🔨"
};

export default function ThirdPartyTradesInfo({ job }) {
  const { data: tradeRequirements = [] } = useQuery({
    queryKey: ['jobTradeRequirements', job?.project_id],
    queryFn: () => base44.entities.ProjectTradeRequirement.filter({ project_id: job.project_id }),
    enabled: !!job?.project_id
  });

  // Filter trades applicable to this job
  const applicableTrades = tradeRequirements.filter(trade => {
    if (trade.applies_to_all_jobs) return true;
    if (!trade.applies_to_job_types || trade.applies_to_job_types.length === 0) return true;
    return trade.applies_to_job_types.includes(job.job_type_name);
  });

  if (applicableTrades.length === 0) return null;

  const requiredTrades = applicableTrades.filter(t => t.is_required);
  const unbookedRequired = requiredTrades.filter(t => !t.is_booked);

  return (
    <Card className="border border-[#E5E7EB] shadow-sm rounded-lg">
      <CardHeader className="bg-white px-4 py-3 border-b border-[#E5E7EB]">
        <CardTitle className="text-[16px] font-semibold text-[#111827] leading-[1.2] flex items-center gap-2">
          <Users className="w-5 h-5" />
          Third-Party Trades Required
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-2">
        {unbookedRequired.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-start gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-amber-800">
              <strong>{unbookedRequired.length} trade{unbookedRequired.length !== 1 ? 's' : ''} not yet booked</strong>
            </div>
          </div>
        )}

        {applicableTrades.map((trade) => (
          <div
            key={trade.id}
            className={`border rounded-lg p-3 ${
              trade.is_booked 
                ? 'bg-green-50 border-green-200' 
                : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{tradeTypeIcons[trade.trade_type]}</span>
                <div>
                  <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                    {trade.trade_type}
                    {trade.is_booked ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-300" />
                    )}
                  </h4>
                  {trade.description && (
                    <p className="text-xs text-slate-600 mt-0.5">{trade.description}</p>
                  )}
                </div>
              </div>
            </div>

            {(trade.contact_name || trade.contact_phone || trade.contact_email) && (
              <div className="flex flex-wrap gap-3 text-xs text-slate-600 mb-2">
                {trade.contact_name && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {trade.contact_name}
                  </span>
                )}
                {trade.contact_phone && (
                  <a 
                    href={`tel:${trade.contact_phone}`}
                    className="flex items-center gap-1 hover:text-blue-600"
                  >
                    <Phone className="w-3 h-3" />
                    {trade.contact_phone}
                  </a>
                )}
                {trade.contact_email && (
                  <a 
                    href={`mailto:${trade.contact_email}`}
                    className="flex items-center gap-1 hover:text-blue-600"
                  >
                    <Mail className="w-3 h-3" />
                    {trade.contact_email}
                  </a>
                )}
              </div>
            )}

            {trade.notes_for_site && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
                <strong>Site Notes:</strong> {trade.notes_for_site}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}