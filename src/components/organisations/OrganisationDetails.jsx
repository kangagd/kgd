import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Trash2, MapPin, Phone, Mail, User, Hash, Building2, FileText } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

const organisationTypeColors = {
  "Strata": "bg-purple-50 text-purple-700 border-purple-200",
  "Builder": "bg-blue-50 text-blue-700 border-blue-200",
  "Real Estate": "bg-green-50 text-green-700 border-green-200",
  "Supplier": "bg-orange-50 text-orange-700 border-orange-200",
};

export default function OrganisationDetails({ organisation, onClose, onEdit, onDelete }) {
  const navigate = useNavigate();

  const { data: customers = [] } = useQuery({
    queryKey: ['organisationCustomers', organisation.id],
    queryFn: () => base44.entities.Customer.filter({ organisation_id: organisation.id, deleted_at: { $exists: false } })
  });

  return (
    <div className="p-2 md:p-4 space-y-2 md:space-y-3">
      {/* Header Card */}
      <Card className="shadow-sm border border-slate-200">
        <CardContent className="p-3 md:p-4">
          <div className="flex items-start justify-between gap-3 md:gap-4">
            <div className="flex items-start gap-2 md:gap-3 flex-1 min-w-0">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose}
                className="hover:bg-slate-100 h-8 w-8 md:h-9 md:w-9 flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg md:text-xl font-semibold text-slate-900 mb-1.5 md:mb-2">{organisation.name}</h1>
                <div className="flex gap-1.5 md:gap-2 flex-wrap">
                  <Badge className={`${organisationTypeColors[organisation.organisation_type]} rounded-lg px-2 py-1 text-xs font-semibold border-2`}>
                    {organisation.organisation_type}
                  </Badge>
                  {organisation.status === 'inactive' && (
                    <Badge className="bg-gray-50 text-gray-700 border-gray-200 rounded-lg px-2 py-1 text-xs font-semibold border-2">
                      Inactive
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-1.5 md:gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="icon"
                onClick={onEdit}
                className="border-slate-300 hover:bg-slate-50 h-8 w-8 md:h-9 md:w-9"
              >
                <Edit className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="border-slate-300 hover:bg-red-50 hover:text-red-600 h-8 w-8 md:h-9 md:w-9"
                  >
                    <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-lg border border-slate-200">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-base md:text-lg font-semibold">Delete Organisation?</AlertDialogTitle>
                    <AlertDialogDescription className="text-xs md:text-sm text-slate-600">
                      This will remove the organisation. Linked customers will remain but will no longer be associated with this organisation.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-lg font-medium border-slate-300 text-sm">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onDelete}
                      className="bg-red-600 hover:bg-red-700 rounded-lg font-medium text-sm"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details Card */}
      <Card className="shadow-sm border border-slate-200">
        <CardContent className="p-3 md:p-4 space-y-2 md:space-y-3">
          <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
            <Building2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-500" />
            <span className="text-[10px] md:text-xs font-medium text-slate-500 uppercase tracking-wide">Details</span>
          </div>
          
          <div className="space-y-1.5 md:space-y-2">
            {organisation.organisation_type === "Strata" && organisation.sp_number && (
              <div>
                <div className="text-[10px] md:text-xs font-medium text-slate-500 uppercase tracking-wide mb-0.5 md:mb-1">SP Number</div>
                <p className="text-xs md:text-sm text-slate-900 font-medium">{organisation.sp_number}</p>
              </div>
            )}

            {organisation.address && (
              <div>
                <div className="text-[10px] md:text-xs font-medium text-slate-500 uppercase tracking-wide mb-0.5 md:mb-1">Address</div>
                <p className="text-xs md:text-sm text-slate-900 font-medium">{organisation.address}</p>
              </div>
            )}

            {organisation.phone && (
              <div>
                <div className="text-[10px] md:text-xs font-medium text-slate-500 uppercase tracking-wide mb-0.5 md:mb-1">Phone</div>
                <a href={`tel:${organisation.phone}`} className="text-xs md:text-sm text-blue-600 hover:underline font-medium">
                  {organisation.phone}
                </a>
              </div>
            )}

            {organisation.email && (
              <div>
                <div className="text-[10px] md:text-xs font-medium text-slate-500 uppercase tracking-wide mb-0.5 md:mb-1">Email</div>
                <a href={`mailto:${organisation.email}`} className="text-xs md:text-sm text-blue-600 hover:underline font-medium">
                  {organisation.email}
                </a>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notes Card */}
      {organisation.notes && (
        <Collapsible defaultOpen={false}>
          <Card className="shadow-sm border border-slate-200">
            <CollapsibleTrigger className="w-full">
              <CardContent className="p-3 md:p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 md:gap-2">
                    <FileText className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-500" />
                    <span className="text-[10px] md:text-xs font-medium text-slate-500 uppercase tracking-wide">Notes</span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-400 transition-transform data-[state=open]:rotate-180" />
                </div>
              </CardContent>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="px-3 md:px-4 pb-3 md:pb-4 pt-0">
                <div 
                  className="text-xs md:text-sm text-slate-700 leading-relaxed prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: organisation.notes }}
                />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Customers Card */}
      <Card className="shadow-sm border border-slate-200">
        <CardContent className="p-3 md:p-4 space-y-2 md:space-y-3">
          <div className="flex items-center gap-1.5 md:gap-2">
            <User className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-500" />
            <span className="text-[10px] md:text-xs font-medium text-slate-500 uppercase tracking-wide">
              Linked Customers ({customers.length})
            </span>
          </div>

          {customers.length === 0 ? (
            <div className="text-center py-6 md:py-8 bg-slate-50 rounded-lg border border-slate-200">
              <User className="w-8 h-8 md:w-10 md:h-10 mx-auto text-slate-300 mb-1.5 md:mb-2" />
              <p className="text-xs md:text-sm text-slate-500">No customers linked</p>
            </div>
          ) : (
            <div className="space-y-1.5 md:space-y-2">
              {customers.map((customer) => (
                <div
                  key={customer.id}
                  onClick={() => navigate(createPageUrl('Customers') + `?customerId=${customer.id}`)}
                  className="p-2.5 md:p-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs md:text-sm font-semibold text-slate-900">{customer.name}</h4>
                      <div className="text-[10px] md:text-xs text-slate-600 mt-0.5 space-y-0.5">
                        {customer.phone && <p>{customer.phone}</p>}
                        {customer.email && <p className="truncate">{customer.email}</p>}
                      </div>
                    </div>
                    {customer.status === 'inactive' && (
                      <Badge className="bg-gray-50 text-gray-700 border-gray-200 rounded-lg px-2 py-1 text-xs font-semibold border-2">
                        Inactive
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}