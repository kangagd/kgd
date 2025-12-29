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
      const result = await base44.entities.Customer.filter({ 
        organisation_id: organisation.id, 
        deleted_at: { $exists: false } 
      });
      console.log('Fetched customers for organisation:', organisation.id, result);
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
    <div className="p-6 max-w-5xl mx-auto">
      <Card className="border-2 border-slate-200 shadow-lg rounded-2xl">
        <CardHeader className="border-b-2 border-slate-200 bg-gradient-to-r from-slate-50 to-white p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4 flex-1">
              <BackButton onClick={onClose} />
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <CardTitle className="text-2xl font-bold text-[#000000] tracking-tight">
                    {organisation.name}
                  </CardTitle>
                  <OrganisationTypeBadge value={organisation.organisation_type} />
                  {organisation.status === 'inactive' && (
                    <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300">
                      Inactive
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                className="border-2 hover:bg-slate-100 font-semibold"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-2 hover:bg-red-100 hover:text-red-600 hover:border-red-200"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-xl font-bold text-[#000000]">Delete Organisation?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove the organisation. Linked customers will remain but will no longer be associated with this organisation.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-2 font-semibold">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onDelete}
                      className="bg-red-600 hover:bg-red-700 font-semibold"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {organisation.organisation_type === "Strata" && organisation.sp_number && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-500 text-sm font-semibold">
                  <Hash className="w-4 h-4" />
                  <span>SP Number</span>
                </div>
                <p className="text-[#000000] font-medium">{organisation.sp_number}</p>
              </div>
            )}

            {organisation.address && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-500 text-sm font-semibold">
                  <MapPin className="w-4 h-4" />
                  <span>Address</span>
                </div>
                <p className="text-[#000000] font-medium">{organisation.address}</p>
              </div>
            )}

            {organisation.phone && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-500 text-sm font-semibold">
                  <Phone className="w-4 h-4" />
                  <span>Phone</span>
                </div>
                <a href={`tel:${organisation.phone}`} className="text-blue-600 hover:underline font-medium">
                  {organisation.phone}
                </a>
              </div>
            )}

            {organisation.email && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-500 text-sm font-semibold">
                  <Mail className="w-4 h-4" />
                  <span>Email</span>
                </div>
                <a href={`mailto:${organisation.email}`} className="text-blue-600 hover:underline font-medium">
                  {organisation.email}
                </a>
              </div>
            )}
          </div>

          {organisation.notes && (
            <div className="pt-4 border-t-2 border-slate-200">
              <h3 className="text-sm font-bold text-slate-500 mb-2">Notes</h3>
              <div 
                className="text-slate-700 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: organisation.notes }}
              />
            </div>
          )}

          <div className="pt-4 border-t-2 border-slate-200">
            {/* Contracts Section */}
            {contracts.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-bold text-[#000000] tracking-tight mb-3">Contracts</h3>
                <div className="grid gap-3">
                  {contracts.map(contract => (
                    <Card key={contract.id} className="border-2 border-blue-100 bg-blue-50">
                      <CardContent className="p-4 flex justify-between items-center">
                        <div>
                          <div className="font-bold text-blue-900 text-lg">{contract.name}</div>
                          <div className="text-sm text-blue-700 mt-1">
                            {contract.status} • {contract.start_date} - {contract.end_date || 'Ongoing'}
                          </div>
                        </div>
                        <Button onClick={() => navigate(createPageUrl('Contracts'))} variant="outline" className="bg-white border-blue-200 text-blue-700 hover:bg-blue-100">
                          View Dashboard
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <Tabs defaultValue="customers">
              <TabsList className="mb-4">
                <TabsTrigger value="customers">Linked Customers ({customers.length})</TabsTrigger>
                <TabsTrigger value="stations">Stations ({customers.filter(c => c.is_station).length})</TabsTrigger>
                <TabsTrigger value="jobs">All Jobs ({orgJobs.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="customers">
                {customersLoading ? (
                  <div className="text-center py-8 bg-slate-50 rounded-xl border-2 border-slate-200">
                    <p className="text-slate-600">Loading customers...</p>
                  </div>
                ) : customers.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-xl border-2 border-slate-200">
                    <User className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-600">No customers linked to this organisation</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {customers.map((customer) => (
                      <Card
                        key={customer.id}
                        className="hover:shadow-md transition-all cursor-pointer border-2 border-slate-200 rounded-xl"
                        onClick={() => navigate(createPageUrl('Customers') + `?customerId=${customer.id}`)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-bold text-[#000000]">{customer.name}</h4>
                              <div className="text-sm text-slate-600 mt-1 space-y-0.5">
                                {customer.phone && <p>Phone: {customer.phone}</p>}
                                {customer.email && <p>Email: {customer.email}</p>}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {customer.is_station && <Badge className="bg-purple-100 text-purple-700">Station</Badge>}
                              {customer.status === 'inactive' && (
                                <Badge variant="outline" className="bg-slate-100 text-slate-600">
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
                      className="hover:shadow-md transition-all cursor-pointer border-2 border-slate-200 rounded-xl"
                      onClick={() => navigate(createPageUrl('Customers') + `?customerId=${customer.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-bold text-[#000000]">{customer.name}</h4>
                            <div className="text-sm text-slate-600 mt-1">
                              Station / Site
                            </div>
                          </div>
                          <Badge className="bg-purple-100 text-purple-700">Station</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {customers.filter(c => c.is_station).length === 0 && (
                    <p className="text-gray-500">No stations found.</p>
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