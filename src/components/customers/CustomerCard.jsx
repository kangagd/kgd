import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, Mail, Building2, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import AddressLink from "../common/AddressLink";

const customerTypeColors = {
  "Owner": "bg-purple-100 text-purple-700",
  "Builder": "bg-blue-100 text-blue-700",
  "Real Estate - Tenant": "bg-green-100 text-green-700",
  "Strata - Owner": "bg-amber-100 text-amber-700",
};

export default function CustomerCard({ customer, onClick, onViewDetails }) {
  const handleClick = (e) => {
    e.stopPropagation();
    if (onViewDetails) {
      onViewDetails(customer);
    } else if (onClick) {
      onClick();
    }
  };

  return (
    <Card 
      className="hover:shadow-lg transition-all duration-200 cursor-pointer hover:border-[#FAE008] border border-[#E5E7EB] rounded-xl"
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <Collapsible>
          <div className="space-y-3">
            {/* Header Row */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[18px] font-semibold text-[#111827] leading-[1.2]">
                  {customer.name}
                </h3>
                {customer.customer_type && (
                  <Badge className={`${customerTypeColors[customer.customer_type]} font-medium border-0 px-2.5 py-0.5 rounded-lg text-[12px] leading-[1.35]`}>
                    {customer.customer_type}
                  </Badge>
                )}
              </div>
            </div>

            {/* Primary Contact Info */}
            <div className="space-y-2">
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
            {(customer.address || customer.secondary_phone || customer.organisation_name || customer.notes) && (
              <CollapsibleTrigger 
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-2 text-sm font-medium text-[#6B7280] hover:text-[#111827] transition-colors group w-full pt-2 border-t border-[#E5E7EB]"
              >
                <span>More Details</span>
                <ChevronDown className="w-4 h-4 transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
            )}
          </div>

          {(customer.address || customer.secondary_phone || customer.organisation_name || customer.notes) && (
            <CollapsibleContent className="pt-3" onClick={(e) => e.stopPropagation()}>
              <div className="bg-[#F8F9FA] rounded-lg p-3 space-y-2">
                {customer.address && (
                  <div>
                    <div className="text-[12px] font-medium text-[#6B7280] leading-[1.35] mb-1">Address</div>
                    <AddressLink address={customer.address} className="text-[14px] text-[#4B5563]" />
                  </div>
                )}
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