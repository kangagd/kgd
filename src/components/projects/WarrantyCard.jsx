import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Calendar, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function WarrantyCard({ project }) {
  if (!project.warranty_enabled) {
    return (
      <Card className="border border-[#E5E7EB] shadow-sm rounded-lg">
        <CardHeader className="bg-white px-4 py-3 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#6B7280]" />
            <CardTitle className="text-[16px] font-semibold text-[#111827]">Warranty</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <p className="text-[14px] text-[#6B7280]">Warranty disabled</p>
        </CardContent>
      </Card>
    );
  }

  const warrantyActive = project.warranty_status === 'Active';
  const hasWarrantyDates = project.warranty_start_date && project.warranty_end_date;

  return (
    <Card className="border border-[#E5E7EB] shadow-sm rounded-lg">
      <CardHeader className="bg-white px-4 py-3 border-b border-[#E5E7EB]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#6B7280]" />
            <CardTitle className="text-[16px] font-semibold text-[#111827]">Warranty</CardTitle>
          </div>
          {project.warranty_status && (
            <Badge variant={warrantyActive ? "success" : "warning"}>
              {project.warranty_status}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {!hasWarrantyDates ? (
          <p className="text-[14px] text-[#6B7280]">
            Warranty will be activated when project is completed
          </p>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-[#4B5563] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-[12px] text-[#6B7280] mb-0.5">Start Date</div>
                <div className="text-[14px] font-medium text-[#111827]">
                  {format(parseISO(project.warranty_start_date), 'MMM d, yyyy')}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-[#4B5563] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-[12px] text-[#6B7280] mb-0.5">End Date</div>
                <div className="text-[14px] font-medium text-[#111827]">
                  {format(parseISO(project.warranty_end_date), 'MMM d, yyyy')}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-[#4B5563] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-[12px] text-[#6B7280] mb-0.5">Duration</div>
                <div className="text-[14px] font-medium text-[#111827]">
                  {project.warranty_duration_months || 12} months
                </div>
              </div>
            </div>

            {!warrantyActive && (
              <div className="mt-3 pt-3 border-t border-[#E5E7EB]">
                <p className="text-[12px] text-[#6B7280] italic">
                  Warranty period has ended ({project.warranty_duration_months || 12} months from completion)
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}