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
import { toast } from "sonner";

export default function Customers() {
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [customerTypeFilter, setCustomerTypeFilter] = useState("all");
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const [showCleanupView, setShowCleanupView] = useState(false);
  const [selectedForDeletion, setSelectedForDeletion] = useState(new Set());
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
        // Error loading user
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
    mutationFn: async (customerId) => {
      const updated = await base44.entities.Customer.update(customerId, { deleted_at: new Date().toISOString() });
      // Re-evaluate other customers that might have been marked as duplicates to this one
      try {
        await base44.functions.invoke('reevaluateDuplicatesAfterDeletion', {
          entity_type: 'Customer'
        });
      } catch (error) {
        console.error('Error re-evaluating duplicates after deletion:', error);
      }
      return updated;
    },
    onSuccess: (updatedCustomer, deletedId) => {
      queryClient.setQueryData(['allCustomers'], (old) => 
        (old || []).map(c => c.id === deletedId ? { ...c, deleted_at: updatedCustomer.deleted_at } : c)
      );
      queryClient.invalidateQueries({ queryKey: ['allCustomers'] });
      setSelectedCustomer(null);
    },
    onError: (error) => {
      toast.error("Failed to delete customer. Please try again.");
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (customerIds) => {
      const deletedAt = new Date().toISOString();
      await Promise.all(
        customerIds.map(id => base44.entities.Customer.update(id, { deleted_at: deletedAt }))
      );
      try {
        await base44.functions.invoke('reevaluateDuplicatesAfterDeletion', {
          entity_type: 'Customer'
        });
      } catch (error) {
        console.error('Error re-evaluating duplicates after deletion:', error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allCustomers'] });
      setSelectedForDeletion(new Set());
      toast.success("Customers deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete customers. Please try again.");
    }
  });

  const handleSubmit = async (data) => {
    if (editingCustomer) {
      await updateCustomerMutation.mutateAsync({ id: editingCustomer.id, data });
    } else {
      await createCustomerMutation.mutateAsync(data);
    }
    return true;
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setShowForm(true);
    setSelectedCustomer(null);
  };

  const handleDelete = (customerId) => {
    deleteCustomerMutation.mutate(customerId);
  };

  const handleBulkDelete = () => {
    if (selectedForDeletion.size === 0) return;
    const idsToDelete = Array.from(selectedForDeletion);
    bulkDeleteMutation.mutate(idsToDelete);
  };

  const toggleSelection = (customerId) => {
    setSelectedForDeletion(prev => {
      const newSet = new Set(prev);
      if (newSet.has(customerId)) {
        newSet.delete(customerId);
      } else {
        newSet.add(customerId);
      }
      return newSet;
    });
  };

  const selectAllUnlinked = () => {
    setSelectedForDeletion(new Set(unknownWithoutLinks.map(c => c.id)));
  };

  const clearSelection = () => {
    setSelectedForDeletion(new Set());
  };

  const handleOpenFullCustomer = (customer) => {
    setModalCustomer(null);
    setSelectedCustomer(customer);
  };

  // Memoized customer filtering to avoid re-computation on every render
  // Potential optimisation: Debounce searchTerm for large customer lists
  const unknownCustomers = React.useMemo(() => {
    return customers.filter(c => c.name === "Unknown").map(customer => {
      const counts = getCustomerCounts(customer.id);
      return { ...customer, ...counts };
    });
  }, [customers, allJobs, allProjects]);

  const unknownWithLinks = React.useMemo(() => {
    return unknownCustomers.filter(c => c.jobCount > 0 || c.projectCount > 0);
  }, [unknownCustomers]);

  const unknownWithoutLinks = React.useMemo(() => {
    return unknownCustomers.filter(c => c.jobCount === 0 && c.projectCount === 0);
  }, [unknownCustomers]);

  const filteredCustomers = React.useMemo(() => customers.filter((customer) => {
    const matchesSearch =
      customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.address?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = customerTypeFilter === "all" || customer.customer_type === customerTypeFilter;
    
    const matchesDuplicateFilter = !showDuplicatesOnly || customer.is_potential_duplicate;
    
    return matchesSearch && matchesType && matchesDuplicateFilter;
  }), [customers, searchTerm, customerTypeFilter, showDuplicatesOnly]);

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
        <div className="flex flex-col md:flex-row justify-between items-center w-full py-3 lg:py-4 mb-4 lg:mb-6 gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#111827] leading-tight">Customers</h1>
            <p className="text-sm text-[#4B5563] mt-1">Manage customer information</p>
          </div>
          {canEditCustomers && (
            <Button
              onClick={() => setShowForm(true)}
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold shadow-sm hover:shadow-md transition w-full md:w-auto h-10 px-4 text-sm rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Customer
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
            <Input
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 border border-[#E5E7EB] focus:border-[#FAE008] focus:ring-2 focus:ring-[#FAE008]/20 transition-all h-12 text-base rounded-lg"
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

          <div className="flex flex-col gap-2">
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
            <div className="flex items-center gap-2">
              <Checkbox
                id="cleanup-filter"
                checked={showCleanupView}
                onCheckedChange={(checked) => {
                  setShowCleanupView(checked);
                  if (!checked) {
                    setSelectedForDeletion(new Set());
                  }
                }}
              />
              <label
                htmlFor="cleanup-filter"
                className="text-sm text-[#4B5563] cursor-pointer flex items-center gap-1.5"
              >
                Cleanup – Unknown Customers
              </label>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i} className="animate-pulse rounded-2xl">
                <CardContent className="p-6">
                  <div className="h-6 bg-[hsl(32,15%,88%)] rounded-lg w-1/3 mb-4"></div>
                  <div className="h-4 bg-[hsl(32,15%,88%)] rounded-lg w-2/3 mb-2"></div>
                  <div className="h-4 bg-[hsl(32,15%,88%)] rounded-lg w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : showCleanupView ? (
          <div className="space-y-6">
            {/* Unknown Customers Without Links */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-[#111827]">
                    Unknown Customers Without Links ({unknownWithoutLinks.length})
                  </h3>
                  <p className="text-sm text-[#6B7280]">Safe to delete - no associated jobs or projects</p>
                </div>
                {unknownWithoutLinks.length > 0 && (
                  <div className="flex items-center gap-2">
                    {selectedForDeletion.size > 0 && (
                      <>
                        <Button
                          variant="outline"
                          onClick={clearSelection}
                          className="h-9"
                        >
                          Clear ({selectedForDeletion.size})
                        </Button>
                        <Button
                          onClick={handleBulkDelete}
                          className="bg-[#DC2626] text-white hover:bg-[#B91C1C] h-9"
                          disabled={bulkDeleteMutation.isPending}
                        >
                          {bulkDeleteMutation.isPending ? "Deleting..." : `Delete ${selectedForDeletion.size} Selected`}
                        </Button>
                      </>
                    )}
                    <Button
                      variant="outline"
                      onClick={selectAllUnlinked}
                      className="h-9"
                    >
                      Select All
                    </Button>
                  </div>
                )}
              </div>
              {unknownWithoutLinks.length === 0 ? (
                <Card className="p-8 text-center">
                  <p className="text-[#6B7280]">No unknown customers without links found</p>
                </Card>
              ) : (
                <div className="grid gap-3">
                  {unknownWithoutLinks.map((customer) => (
                    <Card 
                      key={customer.id}
                      className={`border transition-all ${selectedForDeletion.has(customer.id) ? 'border-[#FAE008] bg-[#FAE008]/5' : 'border-[#E5E7EB]'}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedForDeletion.has(customer.id)}
                            onCheckedChange={() => toggleSelection(customer.id)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-[16px] font-semibold text-[#111827]">Unknown</h3>
                              <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                                <span>Jobs: {customer.jobCount}</span>
                                <span>Projects: {customer.projectCount}</span>
                              </div>
                            </div>
                            <div className="space-y-1 text-sm text-[#4B5563]">
                              {customer.phone && <div>Phone: {customer.phone}</div>}
                              {customer.email && <div>Email: {customer.email}</div>}
                              <div className="text-xs text-[#9CA3AF]">
                                Created: {new Date(customer.created_date).toLocaleDateString()}
                                {customer.updated_date && ` • Updated: ${new Date(customer.updated_date).toLocaleDateString()}`}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Unknown Customers With Links */}
            {unknownWithLinks.length > 0 && (
              <div>
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-[#111827]">
                    Unknown Customers With Links ({unknownWithLinks.length})
                  </h3>
                  <p className="text-sm text-[#DC2626]">Cannot delete - have associated jobs or projects. Manual review required.</p>
                </div>
                <div className="grid gap-3">
                  {unknownWithLinks.map((customer) => (
                    <Card 
                      key={customer.id}
                      className="border border-[#FCA5A5] bg-[#FEF2F2] cursor-pointer hover:shadow-md transition-all"
                      onClick={() => setSelectedCustomer(customer)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 text-[#DC2626] flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-[16px] font-semibold text-[#111827]">Unknown</h3>
                              <div className="flex items-center gap-2 text-xs font-medium">
                                <Badge className="bg-[#DC2626] text-white">
                                  {customer.jobCount} Jobs
                                </Badge>
                                <Badge className="bg-[#DC2626] text-white">
                                  {customer.projectCount} Projects
                                </Badge>
                              </div>
                            </div>
                            <div className="space-y-1 text-sm text-[#4B5563]">
                              {customer.phone && <div>Phone: {customer.phone}</div>}
                              {customer.email && <div>Email: {customer.email}</div>}
                              <div className="text-xs text-[#9CA3AF]">
                                Created: {new Date(customer.created_date).toLocaleDateString()}
                                {customer.updated_date && ` • Updated: ${new Date(customer.updated_date).toLocaleDateString()}`}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : filteredCustomers.length === 0 ? (
          <Card className="p-12 text-center rounded-2xl border-2 border-[hsl(32,15%,88%)]">
            <User className="w-16 h-16 mx-auto text-[hsl(32,15%,88%)] mb-4" />
            <h3 className="text-[18px] font-semibold text-[#111827] leading-[1.2] mb-2">No customers found</h3>
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