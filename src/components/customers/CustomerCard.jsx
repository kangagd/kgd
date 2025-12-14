import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Phone, Mail, MapPin, Building2, ChevronDown, Eye } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CustomerTypeBadge } from "../common/StatusBadge";
import { Button } from "@/components/ui/button";
import { DuplicateBadge } from "../common/DuplicateWarningCard";
import FreshnessBadge from "../common/FreshnessBadge";
import { computeSimpleFreshness } from "../utils/computeFreshness";



export default function CustomerCard({ customer, onClick, onViewDetails }) {
  const freshness = computeSimpleFreshness(customer);
  
  const handleClick = (e) => {
    e.stopPropagation();
    if (onClick) {
      onClick();
    }
  };

  const handlePreview = (e) => {
    e.stopPropagation();
    if (onViewDetails) {
      onViewDetails(customer);
    }
  };

  return (
    <Card 
      className="hover:shadow-lg transition-all duration-200 cursor-pointer hover:border-[#FAE008] border border-[#E5E7EB] rounded-xl relative"
      onClick={handleClick}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-8 w-8 rounded-lg hover:bg-[#F3F4F6] z-10"
        onClick={handlePreview}
      >
        <Eye className="w-4 h-4 text-[#6B7280]" />
      </Button>
      <CardContent className="p-4">
        <Collapsible>
          <div className="space-y-3">
            {/* Header Row */}
            <div>
              <div className="flex items-center justify-between mb-2 pr-8">
                <div className="flex items-center gap-2">
                  <h3 className="text-[18px] font-semibold text-[#111827] leading-[1.2]">
                    {customer.name}
                  </h3>
                  <DuplicateBadge record={customer} size="sm" />
                </div>
                <div className="flex items-center gap-2">
                  <FreshnessBadge {...freshness} />
                  {customer.customer_type && (
                    <CustomerTypeBadge value={customer.customer_type} />
                  )}
                </div>
              </div>
            </div>

            {/* Primary Contact Info */}
            <div className="space-y-2">
              {(customer.address_full || customer.address) && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-[#6B7280] mt-0.5 flex-shrink-0" />
                  <span className="text-[14px] text-[#4B5563] leading-[1.4]">{customer.address_full || customer.address}</span>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
                  <span className="text-[14px] text-[#4B5563] leading-[1.4]">{customer.phone}</span>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
                  <span className="text-[14px] text-[#4B5563] leading-[1.4] truncate">{customer.email}</span>
                </div>
              )}
            </div>

            {/* Expandable Details */}
            {(customer.secondary_phone || customer.organisation_name || customer.notes) && (
              <CollapsibleTrigger 
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-2 text-sm font-medium text-[#6B7280] hover:text-[#111827] transition-colors group w-full pt-2 border-t border-[#E5E7EB]"
              >
                <span>More Details</span>
                <ChevronDown className="w-4 h-4 transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
            )}
          </div>

          {(customer.secondary_phone || customer.organisation_name || customer.notes) && (
            <CollapsibleContent className="pt-3" onClick={(e) => e.stopPropagation()}>
              <div className="bg-[#F8F9FA] rounded-lg p-3 space-y-2">
                {customer.secondary_phone && (
                  <div className="flex items-start gap-2">
                    <Phone className="w-4 h-4 text-[#6B7280] mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-[12px] font-medium text-[#6B7280] leading-[1.35] mb-0.5">Secondary Phone</div>
                      <span className="text-[14px] text-[#4B5563] leading-[1.4]">{customer.secondary_phone}</span>
                    </div>
                  </div>
                )}
                {customer.organisation_name && (
                  <div className="flex items-start gap-2">
                    <Building2 className="w-4 h-4 text-[#6B7280] mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-[12px] font-medium text-[#6B7280] leading-[1.35] mb-0.5">Organisation</div>
                      <span className="text-[14px] text-[#4B5563] leading-[1.4]">{customer.organisation_name}</span>
                    </div>
                  </div>
                )}
                {customer.notes && (
                  <div>
                    <div className="text-[12px] font-medium text-[#6B7280] leading-[1.35] mb-1">Notes</div>
                    <p className="text-[14px] text-[#4B5563] leading-[1.4] whitespace-pre-wrap">{customer.notes}</p>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          )}
        </Collapsible>
      </CardContent>
    </Card>
  );
}