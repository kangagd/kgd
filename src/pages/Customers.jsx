import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, User, AlertTriangle } from "lucide-react";
import CustomerForm from "../components/customers/CustomerForm";
import CustomerDetails from "../components/customers/CustomerDetails";
import CustomerCard from "../components/customers/CustomerCard";
import EntityModal from "../components/common/EntityModal.jsx";
import CustomerModalView from "../components/customers/CustomerModalView";
import { createPageUrl } from "@/utils";
import { DuplicateBadge } from "../components/common/DuplicateWarningCard";

export default function Customers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [customerTypeFilter, setCustomerTypeFilter] = useState("all");
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [modalCustomer, setModalCustomer] = useState(null);
  const queryClient = useQueryClient();

  const { data: allCustomers = [], isLoading, refetch } = useQuery({
    queryKey: ['allCustomers'],
    queryFn: () => base44.entities.Customer.list(),
    refetchInterval: 15000,
  });

  const customers = allCustomers.filter(customer => !customer.deleted_at && customer.status === 'active');

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
    mutationFn: (data) => base44.entities.Customer.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allCustomers'] });
      refetch();
      setShowForm(false);
      setEditingCustomer(null);
    }
  });

  const updateCustomerMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Customer.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allCustomers'] });
      refetch();
      setShowForm(false);
      setEditingCustomer(null);
      setSelectedCustomer(null);
    }
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: (customerId) => base44.entities.Customer.update(customerId, { deleted_at: new Date().toISOString() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allCustomers'] });
      refetch();
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
        <div className="flex flex-col md:flex-row justify-between items-center w-full py-3 lg:py-4 mb-4 lg:mb-6 gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#111827] leading-tight">Customers</h1>
            <p className="text-sm text-[#4B5563] mt-1">Manage customer information</p>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold shadow-sm hover:shadow-md transition w-full md:w-auto h-10 px-4 text-sm rounded-xl"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Customer
          </Button>
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
                <TabsTrigger value="Real Estate - Tenant" className="flex-1 whitespace-nowrap">Real Estate</TabsTrigger>
                <TabsTrigger value="Strata - Owner" className="flex-1 whitespace-nowrap">Strata</TabsTrigger>
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
        ) : filteredCustomers.length === 0 ? (
          <Card className="p-12 text-center rounded-2xl border-2 border-[hsl(32,15%,88%)]">
            <User className="w-16 h-16 mx-auto text-[hsl(32,15%,88%)] mb-4" />
            <h3 className="text-[18px] font-semibold text-[#111827] leading-[1.2] mb-2">No customers found</h3>
            <p className="text-[14px] text-[#6B7280] leading-[1.4]">Try adjusting your search or add a new customer</p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filteredCustomers.map((customer) => (
              <CustomerCard
                key={customer.id}
                customer={customer}
                onClick={() => setSelectedCustomer(customer)}
                onViewDetails={(c) => setModalCustomer(c)}
              />
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