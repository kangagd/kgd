import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, Mail, Users } from "lucide-react";

const organisationTypeColors = {
  "Strata": "bg-purple-100 text-purple-700",
  "Builder": "bg-blue-100 text-blue-700",
  "Real Estate": "bg-green-100 text-green-700",
  "Supplier": "bg-amber-100 text-amber-700"
};

export default function OrganisationModalView({ organisation, customerCount = 0 }) {
  const handleCall = () => {
    if (organisation.phone) {
      window.location.href = `tel:${organisation.phone}`;
    }
  };

  const handleEmail = () => {
    if (organisation.email) {
      window.location.href = `mailto:${organisation.email}`;
    }
  };

  const handleNavigate = () => {
    if (organisation.address) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(organisation.address)}`, '_blank');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="space-y-3">
        <h3 className="text-[22px] font-semibold text-[#111827] leading-[1.2]">
          {organisation.name}
        </h3>

        <div className="flex items-center gap-2 flex-wrap">
          {organisation.organisation_type && (
             <Badge className={organisationTypeColors[organisation.organisation_type] || "bg-gray-100 text-gray-700"}>
               {organisation.organisation_type}
             </Badge>
          )}
          {organisation.sp_number && (
            <Badge variant="outline" className="font-medium">
              SP {organisation.sp_number}
            </Badge>
          )}
        </div>
      </div>

      {/* Contact Info */}
      {organisation.phone && (
        <div className="flex items-start gap-2.5 p-3 bg-[#F8F9FA] rounded-lg">
          <Phone className="w-5 h-5 text-[#6B7280] flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] text-[#6B7280] font-medium mb-0.5">Phone</div>
            <div className="text-[14px] text-[#111827]">{organisation.phone}</div>
          </div>
        </div>
      )}

      {organisation.email && (
        <div className="flex items-start gap-2.5 p-3 bg-[#F8F9FA] rounded-lg">
          <Mail className="w-5 h-5 text-[#6B7280] flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] text-[#6B7280] font-medium mb-0.5">Email</div>
            <div className="text-[14px] text-[#111827]">{organisation.email}</div>
          </div>
        </div>
      )}

      {organisation.address && (
        <div className="flex items-start gap-2.5 p-3 bg-[#F8F9FA] rounded-lg">
          <MapPin className="w-5 h-5 text-[#6B7280] flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] text-[#6B7280] font-medium mb-0.5">Address</div>
            <div className="text-[14px] text-[#111827]">{organisation.address}</div>
          </div>
        </div>
      )}

      {/* Customer Count */}
      <div className="flex items-center gap-2 p-3 bg-[#F8F9FA] rounded-lg">
        <Users className="w-5 h-5 text-[#6B7280]" />
        <div>
          <div className="text-[12px] text-[#6B7280] font-medium">Customers</div>
          <div className="text-[16px] font-semibold text-[#111827]">{customerCount}</div>
        </div>
      </div>

      {/* Notes Preview */}
      {organisation.notes && organisation.notes !== "<p><br></p>" && (
        <div className="p-3 bg-[#F8F9FA] rounded-lg">
          <div className="text-[12px] text-[#6B7280] font-medium mb-1">Notes</div>
          <div 
            className="text-[14px] text-[#4B5563] line-clamp-3 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: organisation.notes }}
          />
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-2 pt-2">
        {organisation.phone && (
          <Button
            onClick={handleCall}
            variant="outline"
            size="sm"
          >
            <Phone className="w-4 h-4" />
          </Button>
        )}
        {organisation.email && (
          <Button
            onClick={handleEmail}
            variant="outline"
            size="sm"
          >
            <Mail className="w-4 h-4" />
          </Button>
        )}
        {organisation.address && (
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