import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, User, AlertTriangle, Phone, Mail, MapPin, Building2, ChevronDown, Eye } from "lucide-react";
import { AddIconButton } from "@/components/ui/AddIconButton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CustomerTypeBadge } from "../components/common/StatusBadge";
import CustomerForm from "../components/customers/CustomerForm";
import CustomerDetails from "../components/customers/CustomerDetails";
import CustomerCard from "../components/customers/CustomerCard";
import EntityModal from "../components/common/EntityModal.jsx";
import CustomerModalView from "../components/customers/CustomerModalView";
import { createPageUrl } from "@/utils";
import { DuplicateBadge } from "../components/common/DuplicateWarningCard";
import BackButton from "../components/common/BackButton";

export default function Customers() {
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [customerTypeFilter, setCustomerTypeFilter] = useState("all");
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [modalCustomer, setModalCustomer] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isAdminOrManager = isAdmin || isManager;
  const isViewer = user?.role === 'viewer';
  const canEditCustomers = isAdminOrManager;

  const { data: allCustomers = [], isLoading, refetch } = useQuery({
    queryKey: ['allCustomers'],
    queryFn: () => base44.entities.Customer.list(),
    refetchInterval: 15000,
  });

  const customers = allCustomers.filter(customer => !customer.deleted_at && customer.status === 'active');

  // Handle URL params for direct navigation
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const customerId = params.get('customerId');
    
    if (customerId && customers.length > 0 && !selectedCustomer) {
      const customer = customers.find((c) => c.id === customerId);
      if (customer) {
        setSelectedCustomer(customer);
      }
    }
  }, [customers, selectedCustomer]);

  const { data: allJobs = [] } = useQuery({
    queryKey: ['allJobs'],
    queryFn: () => base44.entities.Job.list(),
  });

  const { data: allProjects = [] } = useQuery({
    queryKey: ['allProjects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const getCustomerCounts = (customerId) => {
    const jobCount = allJobs.filter(j => j.customer_id === customerId && !j.deleted_at).length;
    const projectCount = allProjects.filter(p => p.customer_id === customerId && !p.deleted_at).length;
    return { jobCount, projectCount };
  };

  const createCustomerMutation = useMutation({
    mutationFn: async (data) => {
      const newCustomer = await base44.entities.Customer.create(data);
      // Run duplicate check and update the record with flags
      await base44.functions.invoke('checkDuplicates', {
        entity_type: 'Customer',
        record: newCustomer,
        exclude_id: newCustomer.id,
        auto_update: true
      });
      return newCustomer;
    },
    onSuccess: (newCustomer) => {
      queryClient.setQueryData(['allCustomers'], (old) => [newCustomer, ...(old || [])]);
      queryClient.invalidateQueries({ queryKey: ['allCustomers'] });
      setShowForm(false);
      setEditingCustomer(null);
    }
  });

  const updateCustomerMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const updated = await base44.entities.Customer.update(id, data);
      // Run duplicate check and update the record with flags
      await base44.functions.invoke('checkDuplicates', {
        entity_type: 'Customer',
        record: { ...data, id },
        exclude_id: id,
        auto_update: true
      });
      return updated;
    },
    onSuccess: (updatedCustomer) => {
      queryClient.setQueryData(['allCustomers'], (old) => 
        (old || []).map(c => c.id === updatedCustomer.id ? updatedCustomer : c)
      );
      queryClient.invalidateQueries({ queryKey: ['allCustomers'] });
      setShowForm(false);
      setEditingCustomer(null);
      setSelectedCustomer(null);
    }
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: (customerId) => base44.entities.Customer.update(customerId, { deleted_at: new Date().toISOString() }),
    onSuccess: (updatedCustomer, deletedId) => {
      queryClient.setQueryData(['allCustomers'], (old) => 
        (old || []).map(c => c.id === deletedId ? { ...c, deleted_at: updatedCustomer.deleted_at } : c)
      );
      queryClient.invalidateQueries({ queryKey: ['allCustomers'] });
      setSelectedCustomer(null);
    },
    onError: (error) => {
      console.error("Error deleting customer:", error);
      alert("Failed to delete customer. Please try again.");
    }
  });

  const handleSubmit = (data) => {
    if (editingCustomer) {
      updateCustomerMutation.mutate({ id: editingCustomer.id, data });
    } else {
      createCustomerMutation.mutate(data);
    }
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setShowForm(true);
    setSelectedCustomer(null);
  };

  const handleDelete = (customerId) => {
    deleteCustomerMutation.mutate(customerId);
  };

  const handleOpenFullCustomer = (customer) => {
    setModalCustomer(null);
    setSelectedCustomer(customer);
  };

  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch =
      customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.address?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = customerTypeFilter === "all" || customer.customer_type === customerTypeFilter;
    
    const matchesDuplicateFilter = !showDuplicatesOnly || customer.is_potential_duplicate;
    
    return matchesSearch && matchesType && matchesDuplicateFilter;
  });

  if (showForm) {
    return (
      <div className="p-4 md:p-5 lg:p-10 bg-[#ffffff] min-h-screen overflow-x-hidden">
        <div className="max-w-4xl mx-auto">
          <CustomerForm
            customer={editingCustomer}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingCustomer(null);
            }}
            isSubmitting={createCustomerMutation.isPending || updateCustomerMutation.isPending}
          />
        </div>
      </div>
    );
  }

  if (selectedCustomer) {
    return (
      <div className="p-4 md:p-5 lg:p-10 bg-[#ffffff] min-h-screen overflow-x-hidden">
        <div className="max-w-4xl mx-auto">
          <CustomerDetails
            customer={selectedCustomer}
            onClose={() => setSelectedCustomer(null)}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-5 lg:p-10 bg-[#ffffff] min-h-screen overflow-x-hidden">
      <div className="max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-4">
          <BackButton to={createPageUrl("Dashboard")} />
        </div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center py-3 lg:py-4 mb-4 lg:mb-6 gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-[#111827] leading-tight">Customers</h1>
            <p className="text-sm text-[#4B5563] mt-1">Manage customer information</p>
          </div>
          {canEditCustomers && (
            <div className="flex items-center gap-2 w-full md:w-auto">
              <span className="text-sm font-medium text-[#6B7280]">New Customer</span>
              <AddIconButton
                onClick={() => setShowForm(true)}
                title="Create New Customer"
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
            <Input
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 border border-[#E5E7EB] focus:border-[#111827] focus:ring-1 focus:ring-[#111827] transition-all h-10 text-sm rounded-lg w-full"
            />
          </div>

          <div className="chip-container -mx-4 px-4 md:mx-0 md:px-0">
            <Tabs value={customerTypeFilter} onValueChange={setCustomerTypeFilter} className="w-full">
              <TabsList className="w-full justify-start min-w-max md:min-w-0">
                <TabsTrigger value="all" className="flex-1 whitespace-nowrap">All</TabsTrigger>
                  <TabsTrigger value="Owner" className="flex-1 whitespace-nowrap">Owner</TabsTrigger>
                  <TabsTrigger value="Builder" className="flex-1 whitespace-nowrap">Builder</TabsTrigger>
                  <TabsTrigger value="Real Estate - Tenant" className="flex-1 whitespace-nowrap">RE Tenant</TabsTrigger>
                  <TabsTrigger value="Real Estate - Agent" className="flex-1 whitespace-nowrap">RE Agent</TabsTrigger>
                  <TabsTrigger value="Strata - Owner" className="flex-1 whitespace-nowrap">Strata Owner</TabsTrigger>
                  <TabsTrigger value="Strata - Agent" className="flex-1 whitespace-nowrap">Strata Agent</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="duplicates-filter"
              checked={showDuplicatesOnly}
              onCheckedChange={setShowDuplicatesOnly}
            />
            <label
              htmlFor="duplicates-filter"
              className="text-sm text-[#4B5563] cursor-pointer flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-[#D97706]" />
              Show only potential duplicates
            </label>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i} className="animate-pulse rounded-xl">
                <CardContent className="p-4">
                  <div className="h-5 bg-[#E5E7EB] rounded-lg w-1/3 mb-3"></div>
                  <div className="h-4 bg-[#E5E7EB] rounded-lg w-2/3 mb-2"></div>
                  <div className="h-4 bg-[#E5E7EB] rounded-lg w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredCustomers.length === 0 ? (
          <Card className="p-8 text-center rounded-xl border border-[#E5E7EB]">
            <User className="w-12 h-12 mx-auto text-[#E5E7EB] mb-3" />
            <h3 className="text-[16px] font-semibold text-[#111827] leading-[1.2] mb-2">No customers found</h3>
            <p className="text-[14px] text-[#6B7280] leading-[1.4]">Try adjusting your search or add a new customer</p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filteredCustomers.map((customer) => (
              <Card 
                key={customer.id}
                className="hover:shadow-lg transition-all duration-200 cursor-pointer hover:border-[#FAE008] border border-[#E5E7EB] rounded-xl relative"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCustomer(customer);
                }}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 rounded-lg hover:bg-[#F3F4F6] z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setModalCustomer(customer);
                  }}
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
                          {customer.customer_type && (
                            <CustomerTypeBadge value={customer.customer_type} />
                          )}
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
            ))}
          </div>
        )}

        <EntityModal
          open={!!modalCustomer}
          onClose={() => setModalCustomer(null)}
          title={modalCustomer?.name || "Customer"}
          onOpenFullPage={() => handleOpenFullCustomer(modalCustomer)}
          fullPageLabel="Open Full Customer"
        >
          {modalCustomer && (
            <CustomerModalView 
              customer={modalCustomer} 
              {...getCustomerCounts(modalCustomer.id)}
            />
          )}
        </EntityModal>
      </div>
    </div>
  );
}