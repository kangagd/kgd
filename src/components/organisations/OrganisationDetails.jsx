import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit2, Trash2, MapPin, Phone, Mail, User, Hash, FileText } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import JobList from "../jobs/JobList";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { OrganisationTypeBadge } from "../common/StatusBadge";
import BackButton from "../common/BackButton";
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

export default function OrganisationDetails({ organisation, onClose, onEdit, onDelete }) {
  const navigate = useNavigate();

  const { data: customers = [], isLoading: customersLoading } = useQuery({
    queryKey: ['organisationCustomers', organisation.id],
    queryFn: async () => {
      // First check if ANY customers exist with this organisation_name (legacy)
      const allCustomers = await base44.entities.Customer.filter({ deleted_at: { $exists: false } });
      console.log('All customers:', allCustomers.map(c => ({ 
        id: c.id, 
        name: c.name, 
        organisation_id: c.organisation_id, 
        organisation_name: c.organisation_name 
      })));
      
      // Filter by organisation_id (new way) OR organisation_name (legacy fallback)
      const result = allCustomers.filter(c => 
        c.organisation_id === organisation.id || 
        (c.organisation_name && c.organisation_name.toLowerCase() === organisation.name.toLowerCase())
      );
      
      console.log('Filtered customers for organisation:', organisation.id, organisation.name, result);
      return result;
    },
    enabled: !!organisation.id
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['organisationContracts', organisation.id],
    queryFn: () => base44.entities.Contract.filter({ organisation_id: organisation.id })
  });

  // Fetch all jobs for this org (optional, might be heavy if not paginated, but asked for "Jobs" tab)
  const { data: orgJobs = [] } = useQuery({
    queryKey: ['organisationJobs', organisation.id],
    queryFn: () => base44.entities.Job.filter({ organisation_id: organisation.id })
  });

  return (
    <div className="p-4 md:p-6 lg:p-10 max-w-7xl mx-auto bg-[#ffffff]">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <BackButton onClick={onClose} />
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-[28px] font-bold text-[#111827]">
                {organisation.name}
              </h1>
              <OrganisationTypeBadge value={organisation.organisation_type} />
              {organisation.status === 'inactive' && (
                <Badge variant="outline" className="text-[12px]">
                  Inactive
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              className="text-[14px] h-9"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[14px] h-9 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-xl">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-[18px] font-semibold text-[#111827]">Delete Organisation?</AlertDialogTitle>
                  <AlertDialogDescription className="text-[14px] text-[#6B7280]">
                    This will remove the organisation. Linked customers will remain but will no longer be associated with this organisation.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="text-[14px]">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDelete}
                    className="bg-red-600 hover:bg-red-700 text-[14px]"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      <Card className="border border-[#E5E7EB] shadow-sm rounded-xl">
        <CardHeader className="border-b border-[#E5E7EB] p-6">
          <CardTitle className="text-[18px] font-semibold text-[#111827]">Organisation Details</CardTitle>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {organisation.organisation_type === "Strata" && organisation.sp_number && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[#6B7280] text-[13px] font-medium">
                  <Hash className="w-4 h-4" />
                  <span>SP Number</span>
                </div>
                <p className="text-[#111827] text-[14px] font-medium">{organisation.sp_number}</p>
              </div>
            )}

            {organisation.address && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[#6B7280] text-[13px] font-medium">
                  <MapPin className="w-4 h-4" />
                  <span>Address</span>
                </div>
                <p className="text-[#111827] text-[14px]">{organisation.address}</p>
              </div>
            )}

            {organisation.phone && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[#6B7280] text-[13px] font-medium">
                  <Phone className="w-4 h-4" />
                  <span>Phone</span>
                </div>
                <a href={`tel:${organisation.phone}`} className="text-[#2563EB] hover:underline text-[14px]">
                  {organisation.phone}
                </a>
              </div>
            )}

            {organisation.email && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[#6B7280] text-[13px] font-medium">
                  <Mail className="w-4 h-4" />
                  <span>Email</span>
                </div>
                <a href={`mailto:${organisation.email}`} className="text-[#2563EB] hover:underline text-[14px]">
                  {organisation.email}
                </a>
              </div>
            )}
          </div>

          {organisation.notes && (
            <div className="pt-6 border-t border-[#E5E7EB]">
              <h3 className="text-[14px] font-semibold text-[#111827] mb-2">Notes</h3>
              <div 
                className="text-[#4B5563] text-[14px] prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: organisation.notes }}
              />
            </div>
          )}

          <div className="pt-6 border-t border-[#E5E7EB]">
            {/* Contracts Section */}
            {contracts.length > 0 && (
              <div className="mb-6">
                <h3 className="text-[16px] font-semibold text-[#111827] mb-3">Contracts</h3>
                <div className="grid gap-3">
                  {contracts.map(contract => (
                    <Card key={contract.id} className="border border-[#DBEAFE] bg-[#EFF6FF] rounded-xl">
                      <CardContent className="p-4 flex justify-between items-center">
                        <div>
                          <div className="font-semibold text-[#1E40AF] text-[15px]">{contract.name}</div>
                          <div className="text-[13px] text-[#3B82F6] mt-1">
                            {contract.status} • {contract.start_date} - {contract.end_date || 'Ongoing'}
                          </div>
                        </div>
                        <Button 
                          onClick={() => navigate(createPageUrl('Contracts'))} 
                          variant="outline" 
                          size="sm"
                          className="bg-white border-[#DBEAFE] text-[#2563EB] hover:bg-[#DBEAFE] text-[13px]"
                        >
                          View Dashboard
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <Tabs defaultValue="customers" className="w-full">
              <TabsList className="mb-4 w-full">
                <TabsTrigger value="customers" className="flex-1">Linked Customers ({customers.length})</TabsTrigger>
                <TabsTrigger value="stations" className="flex-1">Stations ({customers.filter(c => c.is_station).length})</TabsTrigger>
                <TabsTrigger value="jobs" className="flex-1">All Jobs ({orgJobs.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="customers">
                {customersLoading ? (
                  <div className="text-center py-12 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB]">
                    <p className="text-[#6B7280] text-[14px]">Loading customers...</p>
                  </div>
                ) : customers.length === 0 ? (
                  <div className="text-center py-12 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB]">
                    <User className="w-12 h-12 mx-auto text-[#D1D5DB] mb-3" />
                    <p className="text-[#6B7280] text-[14px]">No customers linked to this organisation</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {customers.map((customer) => (
                      <Card
                        key={customer.id}
                        className="hover:shadow-md hover:border-[#FAE008] transition-all cursor-pointer border border-[#E5E7EB] rounded-xl"
                        onClick={() => navigate(createPageUrl('Customers') + `?customerId=${customer.id}`)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold text-[#111827] text-[15px]">{customer.name}</h4>
                              <div className="text-[13px] text-[#6B7280] mt-1 space-y-0.5">
                                {customer.phone && <p>Phone: {customer.phone}</p>}
                                {customer.email && <p>Email: {customer.email}</p>}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {customer.is_station && <Badge className="bg-purple-100 text-purple-700 text-[11px]">Station</Badge>}
                              {customer.status === 'inactive' && (
                                <Badge variant="outline" className="text-[11px]">
                                  Inactive
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="stations">
                <div className="grid gap-3">
                  {customers.filter(c => c.is_station).map((customer) => (
                    <Card
                      key={customer.id}
                      className="hover:shadow-md hover:border-[#FAE008] transition-all cursor-pointer border border-[#E5E7EB] rounded-xl"
                      onClick={() => navigate(createPageUrl('Customers') + `?customerId=${customer.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-[#111827] text-[15px]">{customer.name}</h4>
                            <div className="text-[13px] text-[#6B7280] mt-1">
                              Station / Site
                            </div>
                          </div>
                          <Badge className="bg-purple-100 text-purple-700 text-[11px]">Station</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {customers.filter(c => c.is_station).length === 0 && (
                    <div className="text-center py-12 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB]">
                      <p className="text-[#6B7280] text-[14px]">No stations found</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="jobs">
                <JobList 
                  jobs={orgJobs} 
                  isLoading={false} 
                  onSelectJob={() => {}} 
                  onViewDetails={(job) => navigate(createPageUrl('Jobs') + `?jobId=${job.id}`)}
                />
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}