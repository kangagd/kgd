import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, Phone, Mail, MapPin, ShoppingCart, Clock, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import PurchaseOrdersList from "./PurchaseOrdersList";
import SupplierPurchaseOrderModal from "../purchasing/SupplierPurchaseOrderModal";

export default function SupplierDetails({ supplier, onClose, onEdit }) {
  const [poModalOpen, setPoModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <Card className="border-2 border-slate-200 shadow-lg rounded-2xl">
        <CardHeader className="border-b-2 border-slate-200 bg-gradient-to-r from-slate-50 to-white p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-slate-200 rounded-xl">
                <ArrowLeft className="w-4 h-4" />
              </Button>
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
                            <a href={`tel:${supplier.phone}`} className="text-blue-600 hover:underline">{supplier.phone}</a>
                        </div>
                    )}
                    {supplier.email && (
                        <div className="flex items-center gap-2 text-sm">
                            <Mail className="w-4 h-4 text-slate-400" />
                            <a href={`mailto:${supplier.email}`} className="text-blue-600 hover:underline">{supplier.email}</a>
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Logistics</h3>
                <div className="space-y-3">
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

      {/* Purchase Orders */}
      <Card className="border-2 border-slate-200 shadow-lg rounded-2xl">
        <CardHeader className="border-b border-slate-100 p-4 md:p-6">
            <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">Purchase Orders</CardTitle>
                <Button 
                  size="sm"
                  onClick={() => setPoModalOpen(true)}
                  className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
                >
                  <ShoppingCart className="w-3.5 h-3.5 mr-2" />
                  Create Order
                </Button>
            </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
            <PurchaseOrdersList supplierId={supplier.id} />
        </CardContent>
      </Card>

      <SupplierPurchaseOrderModal 
        open={poModalOpen}
        onClose={() => setPoModalOpen(false)}
        supplier={supplier}
      />
    </div>
  );
}