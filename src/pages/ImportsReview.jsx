import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Search, User, Link2, Check } from "lucide-react";
import { createPageUrl } from "@/utils";
import BackButton from "../components/common/BackButton";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function ImportsReview() {
  const [entityType, setEntityType] = useState("jobs");
  const [searchTerm, setSearchTerm] = useState("");
  const [linkingRecord, setLinkingRecord] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const queryClient = useQueryClient();

  const { data: jobsWithMissingCustomer = [], isLoading: loadingJobs } = useQuery({
    queryKey: ['jobsMissingCustomer'],
    queryFn: async () => {
      const allJobs = await base44.entities.Job.list();
      return allJobs.filter(j => !j.customer_id && j.import_customer_name_raw && !j.deleted_at);
    }
  });

  const { data: projectsWithMissingCustomer = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['projectsMissingCustomer'],
    queryFn: async () => {
      const allProjects = await base44.entities.Project.list();
      return allProjects.filter(p => !p.customer_id && p.import_customer_name_raw && !p.deleted_at);
    }
  });

  const { data: allCustomers = [] } = useQuery({
    queryKey: ['allCustomers'],
    queryFn: () => base44.entities.Customer.list()
  });

  const linkCustomerMutation = useMutation({
    mutationFn: async ({ recordId, customerId, entityType }) => {
      const customer = allCustomers.find(c => c.id === customerId);
      if (!customer) throw new Error('Customer not found');

      const updates = {
        customer_id: customerId,
        customer_name: customer.name,
        customer_phone: customer.phone,
        customer_email: customer.email,
        customer_type: customer.customer_type,
        import_customer_name_raw: null
      };

      if (entityType === 'job') {
        await base44.entities.Job.update(recordId, updates);
      } else {
        await base44.entities.Project.update(recordId, updates);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobsMissingCustomer'] });
      queryClient.invalidateQueries({ queryKey: ['projectsMissingCustomer'] });
      setLinkingRecord(null);
      setSelectedCustomerId(null);
      toast.success('Customer linked successfully');
    }
  });

  const records = entityType === "jobs" ? jobsWithMissingCustomer : projectsWithMissingCustomer;
  const isLoading = entityType === "jobs" ? loadingJobs : loadingProjects;

  const filteredCustomers = allCustomers.filter(c => 
    !c.deleted_at && 
    c.status === 'active' &&
    (c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     c.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     c.email?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-4 md:p-5 lg:p-10 bg-[#ffffff] min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <BackButton to={createPageUrl("Dashboard")} />
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#111827]">Import Review</h1>
          <p className="text-sm text-[#4B5563] mt-1">
            Records with missing customer assignments
          </p>
        </div>

        <Tabs value={entityType} onValueChange={setEntityType} className="mb-6">
          <TabsList>
            <TabsTrigger value="jobs" className="flex items-center gap-2">
              Jobs
              {jobsWithMissingCustomer.length > 0 && (
                <Badge className="bg-amber-500 text-white ml-1">
                  {jobsWithMissingCustomer.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="projects" className="flex items-center gap-2">
              Projects
              {projectsWithMissingCustomer.length > 0 && (
                <Badge className="bg-amber-500 text-white ml-1">
                  {projectsWithMissingCustomer.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="text-center py-12 text-[#6B7280]">Loading...</div>
        ) : records.length === 0 ? (
          <Card className="border border-[#E5E7EB]">
            <CardContent className="p-12 text-center">
              <Check className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[#111827] mb-2">All Clear!</h3>
              <p className="text-sm text-[#6B7280]">
                No {entityType} with missing customer assignments
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {records.map((record) => (
              <Card key={record.id} className="border-amber-300 bg-amber-50">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                        <h3 className="text-lg font-semibold text-[#111827]">
                          {entityType === 'jobs' 
                            ? `Job #${record.job_number}` 
                            : record.title || 'Project'}
                        </h3>
                      </div>
                      <div className="space-y-1 text-sm text-[#6B7280]">
                        <div>
                          <strong>Import Name:</strong> {record.import_customer_name_raw || 'N/A'}
                        </div>
                        {record.address_full && (
                          <div>
                            <strong>Address:</strong> {record.address_full}
                          </div>
                        )}
                        {record.scheduled_date && (
                          <div>
                            <strong>Scheduled:</strong> {new Date(record.scheduled_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={() => setLinkingRecord(record)}
                      className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
                    >
                      <Link2 className="w-4 h-4 mr-2" />
                      Link Customer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Link Customer Dialog */}
        <Dialog open={!!linkingRecord} onOpenChange={() => {
          setLinkingRecord(null);
          setSelectedCustomerId(null);
          setSearchTerm("");
        }}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Link Customer to {entityType === 'jobs' 
                  ? `Job #${linkingRecord?.job_number}` 
                  : linkingRecord?.title}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="text-sm text-amber-900">
                  <strong>Import Name:</strong> {linkingRecord?.import_customer_name_raw}
                </div>
              </div>

              <div>
                <Label>Search Customers</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                  <Input
                    placeholder="Search by name, phone, or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredCustomers.length === 0 ? (
                  <div className="text-center py-8 text-[#6B7280]">
                    No customers found
                  </div>
                ) : (
                  filteredCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => setSelectedCustomerId(customer.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selectedCustomerId === customer.id
                          ? 'border-[#FAE008] bg-[#FFFEF5]'
                          : 'border-[#E5E7EB] hover:border-[#FAE008]'
                      }`}
                    >
                      <div className="font-semibold text-[#111827]">{customer.name}</div>
                      <div className="text-sm text-[#6B7280] space-y-0.5 mt-1">
                        {customer.phone && <div>📞 {customer.phone}</div>}
                        {customer.email && <div>✉️ {customer.email}</div>}
                        {customer.address_full && <div>📍 {customer.address_full}</div>}
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setLinkingRecord(null);
                    setSelectedCustomerId(null);
                    setSearchTerm("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (selectedCustomerId) {
                      linkCustomerMutation.mutate({
                        recordId: linkingRecord.id,
                        customerId: selectedCustomerId,
                        entityType: entityType === 'jobs' ? 'job' : 'project'
                      });
                    }
                  }}
                  disabled={!selectedCustomerId || linkCustomerMutation.isPending}
                  className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
                >
                  {linkCustomerMutation.isPending ? 'Linking...' : 'Link Customer'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}