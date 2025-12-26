import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, Phone, Mail, MapPin, Clock, Info, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import BackButton from "../common/BackButton";

export default function SupplierDetails({ supplier, onClose, onEdit }) {
  return (
    <div className="space-y-6">
      <Card className="border-2 border-slate-200 shadow-lg rounded-2xl">
        <CardHeader className="border-b-2 border-slate-200 bg-gradient-to-r from-slate-50 to-white p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <BackButton onClick={onClose} />
              <div>
                <div className="flex items-center gap-2">
                    <CardTitle className="text-[22px] font-semibold text-[#111827] leading-[1.2]">{supplier.name}</CardTitle>
                    {!supplier.is_active && (
                        <Badge variant="secondary" className="bg-gray-100 text-gray-500 border-gray-200">Inactive</Badge>
                    )}
                </div>
                {supplier.type && (
                    <div className="text-sm text-slate-500 mt-1">{supplier.type}</div>
                )}
              </div>
            </div>
            <Button 
              onClick={() => onEdit(supplier)} 
              className="bg-[#fae008] hover:bg-[#e5d007] text-[#000000] font-semibold rounded-xl shadow-md"
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6 space-y-6">
          {/* Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Contact Details</h3>
                <div className="space-y-3">
                    {supplier.contact_name && (
                        <div className="flex items-center gap-2 text-sm">
                            <Info className="w-4 h-4 text-slate-400" />
                            <span className="font-medium">{supplier.contact_name}</span>
                        </div>
                    )}
                    {supplier.phone && (
                        <div className="flex items-center gap-2 text-sm">
                            <Phone className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-700">{supplier.phone}</span>
                        </div>
                    )}
                    {supplier.email && (
                        <div className="flex items-center gap-2 text-sm">
                            <Mail className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-700">{supplier.email}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Logistics</h3>
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                        <Truck className="w-4 h-4 text-slate-400" />
                        <span className="capitalize font-medium">{supplier.fulfilment_preference || 'pickup'}</span>
                        {(supplier.fulfilment_preference === 'delivery' || supplier.fulfilment_preference === 'mixed') && supplier.delivery_days && (
                            <span className="text-slate-500">({supplier.delivery_days})</span>
                        )}
                    </div>
                    {supplier.pickup_address && (
                        <div className="flex items-start gap-2 text-sm">
                            <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                            <span className="whitespace-pre-wrap">{supplier.pickup_address}</span>
                        </div>
                    )}
                    {supplier.opening_hours && (
                        <div className="flex items-center gap-2 text-sm">
                            <Clock className="w-4 h-4 text-slate-400" />
                            <span>{supplier.opening_hours}</span>
                        </div>
                    )}
                     {supplier.default_lead_time_days && (
                        <div className="flex items-center gap-2 text-sm">
                            <Clock className="w-4 h-4 text-slate-400" />
                            <span>Lead Time: {supplier.default_lead_time_days} days</span>
                        </div>
                    )}
                </div>
            </div>
          </div>
          
          {supplier.notes && (
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Notes</h4>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{supplier.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Purchase Orders section removed */}
      <Card className="border-2 border-slate-200 shadow-lg rounded-2xl">
        <CardContent className="p-8 text-center">
          <div className="text-[14px] text-[#9CA3AF]">
            Purchase Order management has been removed. New purchasing system coming soon.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}