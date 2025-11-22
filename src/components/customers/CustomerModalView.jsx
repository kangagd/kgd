import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, Mail, Building2, Briefcase, FolderKanban } from "lucide-react";
import { createPageUrl } from "@/utils";

const customerTypeColors = {
  "Owner": "bg-purple-100 text-purple-700",
  "Builder": "bg-blue-100 text-blue-700",
  "Real Estate - Tenant": "bg-green-100 text-green-700",
  "Strata - Owner": "bg-amber-100 text-amber-700"
};

export default function CustomerModalView({ customer, jobCount = 0, projectCount = 0 }) {
  const handleCall = () => {
    if (customer.phone) {
      window.location.href = `tel:${customer.phone}`;
    }
  };

  const handleEmail = () => {
    if (customer.email) {
      window.location.href = `mailto:${customer.email}`;
    }
  };

  const handleNavigate = () => {
    if (customer.address) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.address)}`, '_blank');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="space-y-3">
        <h3 className="text-[22px] font-semibold text-[#111827] leading-[1.2]">
          {customer.name}
        </h3>

        {customer.customer_type && (
          <Badge className={`${customerTypeColors[customer.customer_type]} border-0 font-medium px-3 py-1 rounded-lg`}>
            {customer.customer_type}
          </Badge>
        )}
      </div>

      {/* Organisation */}
      {customer.organisation_name && (
        <div className="flex items-start gap-2.5 p-3 bg-[#F8F9FA] rounded-lg">
          <Building2 className="w-5 h-5 text-[#6B7280] flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] text-[#6B7280] font-medium mb-0.5">Organisation</div>
            <div className="text-[14px] text-[#111827]">{customer.organisation_name}</div>
          </div>
        </div>
      )}

      {/* Contact Info */}
      {customer.phone && (
        <div className="flex items-start gap-2.5 p-3 bg-[#F8F9FA] rounded-lg">
          <Phone className="w-5 h-5 text-[#6B7280] flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] text-[#6B7280] font-medium mb-0.5">Phone</div>
            <div className="text-[14px] text-[#111827]">{customer.phone}</div>
          </div>
        </div>
      )}

      {customer.email && (
        <div className="flex items-start gap-2.5 p-3 bg-[#F8F9FA] rounded-lg">
          <Mail className="w-5 h-5 text-[#6B7280] flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] text-[#6B7280] font-medium mb-0.5">Email</div>
            <div className="text-[14px] text-[#111827]">{customer.email}</div>
          </div>
        </div>
      )}

      {customer.address && (
        <div className="flex items-start gap-2.5 p-3 bg-[#F8F9FA] rounded-lg">
          <MapPin className="w-5 h-5 text-[#6B7280] flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] text-[#6B7280] font-medium mb-0.5">Address</div>
            <div className="text-[14px] text-[#111827]">{customer.address}</div>
          </div>
        </div>
      )}

      {/* Activity Summary */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => window.location.href = `${createPageUrl('Jobs')}?customerId=${customer.id}`}
          className="flex items-center gap-2 p-3 bg-[#F8F9FA] rounded-lg hover:bg-[#E5E7EB] transition-colors cursor-pointer"
        >
          <Briefcase className="w-5 h-5 text-[#6B7280]" />
          <div>
            <div className="text-[12px] text-[#6B7280] font-medium">Jobs</div>
            <div className="text-[16px] font-semibold text-[#111827]">{jobCount}</div>
          </div>
        </button>
        <button
          onClick={() => window.location.href = `${createPageUrl('Projects')}?customerId=${customer.id}`}
          className="flex items-center gap-2 p-3 bg-[#F8F9FA] rounded-lg hover:bg-[#E5E7EB] transition-colors cursor-pointer"
        >
          <FolderKanban className="w-5 h-5 text-[#6B7280]" />
          <div>
            <div className="text-[12px] text-[#6B7280] font-medium">Projects</div>
            <div className="text-[16px] font-semibold text-[#111827]">{projectCount}</div>
          </div>
        </button>
      </div>

      {/* Notes Preview */}
      {customer.notes && customer.notes !== "<p><br></p>" && (
        <div className="p-3 bg-[#F8F9FA] rounded-lg">
          <div className="text-[12px] text-[#6B7280] font-medium mb-1">Notes</div>
          <div 
            className="text-[14px] text-[#4B5563] line-clamp-3 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: customer.notes }}
          />
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-2 pt-2">
        {customer.phone && (
          <Button
            onClick={handleCall}
            variant="outline"
            size="sm"
          >
            <Phone className="w-4 h-4" />
          </Button>
        )}
        {customer.email && (
          <Button
            onClick={handleEmail}
            variant="outline"
            size="sm"
          >
            <Mail className="w-4 h-4" />
          </Button>
        )}
        {customer.address && (
          <Button
            onClick={handleNavigate}
            variant="outline"
            size="sm"
          >
            <MapPin className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}