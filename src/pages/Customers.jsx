import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, User, Phone, Mail, MapPin, Building2 } from "lucide-react";
import CustomerForm from "../components/customers/CustomerForm";
import CustomerDetails from "../components/customers/CustomerDetails";

const customerTypeColors = {
  "Owner": "bg-purple-100 text-purple-700 border-purple-200",
  "Builder": "bg-[#FEF8C8] text-slate-700 border-slate-200",
  "Real Estate - Tenant": "bg-green-100 text-green-700 border-green-200",
  "Strata - Owner": "bg-amber-100 text-amber-700 border-amber-200",
};

export default function Customers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const queryClient = useQueryClient();

  const { data: allCustomers = [], isLoading, refetch } = useQuery({
    queryKey: ['allCustomers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const customers = allCustomers.filter(customer => !customer.deleted_at && customer.status === 'active');

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

  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch =
      customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.address?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  if (showForm) {
    return (
      <div className="p-2 md:p-8 bg-white min-h-screen">
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
      <div className="p-2 md:p-8 bg-white min-h-screen">
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
    <div className="p-4 md:p-8 bg-[#F8F9FA] min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#111827] tracking-tight">Customers</h1>
            <p className="text-[#4B5563] mt-2 text-sm md:text-base">Manage customer information</p>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="btn-primary w-full md:w-auto h-12"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Customer
          </Button>
        </div>

        <div className="mb-6">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#4B5563]" />
            <Input
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-enhanced pl-11 w-full h-12"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i} className="animate-pulse card-enhanced">
                <CardContent className="p-6">
                  <div className="h-6 bg-gray-200 rounded w-1/3 mb-3"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredCustomers.length === 0 ? (
          <Card className="card-enhanced text-center py-12">
            <CardContent>
              <User className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-bold text-[#111827] mb-2">No customers found</h3>
              <p className="text-[#4B5563] text-sm mb-4">Try adjusting your search or add a new customer</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredCustomers.map((customer) => (
              <Card
                key={customer.id}
                className="card-enhanced card-interactive"
                onClick={() => setSelectedCustomer(customer)}
              >
                <CardContent className="p-5 md:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <h3 className="text-base md:text-lg font-bold text-[#111827]">{customer.name}</h3>
                        {customer.customer_type && (
                          <Badge className={`${customerTypeColors[customer.customer_type]} font-semibold border-2 text-xs rounded-lg px-2 py-1`}>
                            {customer.customer_type}
                          </Badge>
                        )}
                      </div>

                      {customer.organisation_name && (
                        <div className="flex items-center gap-2 text-sm text-[#4B5563] mb-2">
                          <Building2 className="w-4 h-4" />
                          <span>{customer.organisation_name}</span>
                        </div>
                      )}

                      {customer.address && (
                        <div className="flex items-start gap-2 text-sm text-[#4B5563] mb-2">
                          <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span>{customer.address}</span>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-3 text-sm text-[#4B5563]">
                        {customer.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            <span className="font-medium">{customer.phone}</span>
                          </div>
                        )}
                        {customer.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            <span className="truncate font-medium">{customer.email}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right text-xs text-[#4B5563] flex-shrink-0">
                      {customer.created_date && (
                        <div>Added {new Date(customer.created_date).toLocaleDateString()}</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}