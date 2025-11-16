import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, User, Phone, Mail, MapPin } from "lucide-react";
import CustomerForm from "../components/customers/CustomerForm";
import CustomerDetails from "../components/customers/CustomerDetails";

const customerTypeColors = {
  "Owner": "bg-purple-100 text-purple-700 border-purple-200",
  "Builder": "bg-blue-100 text-blue-700 border-blue-200",
  "Real Estate - Tenant": "bg-green-100 text-green-700 border-green-200",
  "Strata - Owner": "bg-amber-100 text-amber-700 border-amber-200",
};

export default function Customers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const queryClient = useQueryClient();

  const { data: allCustomers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.filter({ status: 'active' }),
  });

  const customers = allCustomers.filter(customer => !customer.deleted_at);

  const createCustomerMutation = useMutation({
    mutationFn: (data) => base44.entities.Customer.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setShowForm(false);
      setEditingCustomer(null);
    }
  });

  const updateCustomerMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Customer.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setShowForm(false);
      setEditingCustomer(null);
      setSelectedCustomer(null);
    }
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: (customerId) => base44.entities.Customer.update(customerId, { deleted_at: new Date().toISOString() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setSelectedCustomer(null);
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
      <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
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
      <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
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
    <div className="p-4 md:p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#000000] tracking-tight">Customers</h1>
            <p className="text-slate-600 mt-2">Manage customer information</p>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="bg-[#fae008] text-[#000000] hover:bg-[#e5d007] active:bg-[#d4c006] font-semibold shadow-md hover:shadow-lg transition-all w-full md:w-auto"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Customer
          </Button>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all h-12 text-base rounded-xl"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i} className="animate-pulse rounded-2xl">
                <CardContent className="p-6">
                  <div className="h-6 bg-slate-200 rounded-lg w-1/3 mb-4"></div>
                  <div className="h-4 bg-slate-200 rounded-lg w-2/3 mb-2"></div>
                  <div className="h-4 bg-slate-200 rounded-lg w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredCustomers.length === 0 ? (
          <Card className="p-12 text-center rounded-2xl border-2 border-slate-200">
            <User className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-[#000000] mb-2">No customers found</h3>
            <p className="text-slate-600">Try adjusting your search or add a new customer</p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredCustomers.map((customer) => (
              <Card
                key={customer.id}
                className="hover:shadow-xl transition-all duration-200 cursor-pointer border-l-4 hover:scale-[1.01] active:scale-[0.99] group rounded-2xl border-2 border-slate-200"
                style={{ borderLeftColor: '#fae008', borderLeftWidth: '6px' }}
                onClick={() => setSelectedCustomer(customer)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="font-bold text-xl text-[#000000] group-hover:text-blue-600 transition-colors tracking-tight">
                          {customer.name}
                        </h3>
                        {customer.status && (
                          <Badge variant="outline" className="text-xs font-medium border-slate-300">
                            {customer.status}
                          </Badge>
                        )}
                        {customer.customer_type && (
                          <Badge className={`${customerTypeColors[customer.customer_type]} text-xs font-semibold border-2`}>
                            {customer.customer_type}
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-2">
                        {customer.phone && (
                          <div className="flex items-center gap-2 text-slate-700">
                            <Phone className="w-4 h-4 text-slate-400" />
                            <span className="text-sm font-medium">{customer.phone}</span>
                          </div>
                        )}
                        {customer.email && (
                          <div className="flex items-center gap-2 text-slate-700">
                            <Mail className="w-4 h-4 text-slate-400" />
                            <span className="text-sm font-medium truncate">{customer.email}</span>
                          </div>
                        )}
                        {customer.address && (
                          <div className="flex items-start gap-2 text-slate-700">
                            <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                            <span className="text-sm font-medium">{customer.address}</span>
                          </div>
                        )}
                      </div>
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