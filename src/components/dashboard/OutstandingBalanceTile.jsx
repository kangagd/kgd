import React from "react";
import { Badge } from "@/components/ui/badge";
import { FolderKanban, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, parseISO } from "date-fns";

export default function OutstandingBalanceTile({ project }) {
  const navigate = useNavigate();

  return (
    <div
      className="p-4 rounded-xl border border-[#E5E7EB] hover:bg-[#FEF3C7] hover:border-[#D97706] transition-all cursor-pointer"
      onClick={() => navigate(createPageUrl("Projects") + `?projectId=${project.id}`)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <FolderKanban className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
            <h4 className="text-[14px] font-medium text-[#111827] leading-[1.4] truncate">
              #{project.project_number} - {project.title}
            </h4>
          </div>
          <p className="text-[12px] text-[#6B7280] leading-[1.35] mb-1">
            {project.customer_name}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="warning" className="text-[10px]">
              {project.financial_status || 'Awaiting Payment'}
            </Badge>
            {!project.hasInvoices && (
              <Badge variant="error" className="text-[10px] flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                No Invoice
              </Badge>
            )}
          </div>
        </div>
        <div className="text-right ml-4 flex-shrink-0">
          <p className="text-[16px] font-bold text-[#D97706] leading-[1.2]">
            ${project.outstandingBalance.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          {project.completed_date && (() => {
            try {
              return (
                <p className="text-[11px] text-[#6B7280] leading-[1.35] mt-1">
                  {format(parseISO(project.completed_date), 'MMM d')}
                </p>
              );
            } catch {
              return null;
            }
          })()}
        </div>
      </div>
    </div>
  );
}