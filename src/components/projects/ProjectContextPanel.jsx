import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AddressAutocomplete from "../common/AddressAutocomplete";
import CustomerQuickEdit from "./CustomerQuickEdit";

export default function ProjectContextPanel({ project }) {
  const queryClient = useQueryClient();

  return (
    <Card className="border border-[#E5E7EB] shadow-sm rounded-lg overflow-hidden">
      <CardHeader className="bg-white px-4 py-3 border-b border-[#E5E7EB]">
        <h3 className="text-[16px] font-semibold text-[#111827] leading-[1.2]">Customer</h3>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <CustomerQuickEdit
          customerId={project.customer_id}
          projectId={project.id}
          onCustomerUpdate={(updatedData) => {
            queryClient.invalidateQueries({ queryKey: ['project', project.id] });
          }}
        />

        <div className="pt-3 border-t border-[#E5E7EB]">
          <div className="flex items-start gap-2.5">
            <MapPin className="w-5 h-5 text-[#4B5563] flex-shrink-0 mt-1" />
            <div className="flex-1 min-w-0">
              <div className="text-[14px] text-[#6B7280] font-normal leading-[1.4] mb-0.5">Address</div>
              <AddressAutocomplete
                value={project.address_full || project.address}
                onChange={(addressData) => {
                  base44.entities.Project.update(project.id, {
                    address: addressData.address_full,
                    address_full: addressData.address_full,
                    address_street: addressData.address_street,
                    address_suburb: addressData.address_suburb,
                    address_state: addressData.address_state,
                    address_postcode: addressData.address_postcode,
                    address_country: addressData.address_country,
                    google_place_id: addressData.google_place_id,
                    latitude: addressData.latitude,
                    longitude: addressData.longitude
                  }).then(() => {
                    queryClient.invalidateQueries({ queryKey: ['project', project.id] });
                    queryClient.invalidateQueries({ queryKey: ['projects'] });
                  });
                }}
                placeholder="Search for address..."
                className="text-[14px]"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}