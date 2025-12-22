import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Mail, Calendar, Hash } from "lucide-react";
import { format } from "date-fns";

export default function ProjectContextPanel({ project }) {
  if (!project) return null;

  return (
    <div className="space-y-3 sticky top-6">
      <Card className="border border-[#E5E7EB]">
        <div className="p-4 space-y-4">
          {/* Customer Info */}
          <div>
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-semibold text-[#111827] text-sm leading-tight">
                {project.customer_name || "No Customer"}
              </h3>
              {project.customer_type && (
                <Badge variant="secondary" className="text-[10px] px-2 py-0.5 flex-shrink-0">
                  {project.customer_type}
                </Badge>
              )}
            </div>

            {/* Contact Details */}
            <div className="space-y-2">
              {project.customer_phone && (
                <a
                  href={`tel:${project.customer_phone}`}
                  className="flex items-center gap-2 text-xs text-[#4B5563] hover:text-[#111827] transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-[#6B7280] flex-shrink-0" />
                  <span className="truncate">{project.customer_phone}</span>
                </a>
              )}
              {project.customer_email && (
                <a
                  href={`mailto:${project.customer_email}`}
                  className="flex items-center gap-2 text-xs text-[#4B5563] hover:text-[#111827] transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-[#6B7280] flex-shrink-0" />
                  <span className="truncate">{project.customer_email}</span>
                </a>
              )}
            </div>
          </div>

          {/* Address */}
          {project.address_full && (
            <div className="pt-3 border-t border-[#E5E7EB]">
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#6B7280] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[#4B5563] leading-relaxed">
                  {project.address_full}
                </p>
              </div>
            </div>
          )}

          {/* Project Meta */}
          <div className="pt-3 border-t border-[#E5E7EB] space-y-1.5">
            {project.project_number && (
              <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                <Hash className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Project #{project.project_number}</span>
              </div>
            )}
            {project.created_date && (
              <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Created {format(new Date(project.created_date), "MMM d, yyyy")}</span>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}