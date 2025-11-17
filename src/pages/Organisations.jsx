import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Building2, Search, Plus, Phone, Mail, MapPin, Users } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import OrganisationForm from "../components/organisations/OrganisationForm";
import OrganisationDetails from "../components/organisations/OrganisationDetails";

const organisationTypeColors = {
  "Strata": "bg-purple-100 text-purple-700 border-purple-200",
  "Builder": "bg-blue-100 text-blue-700 border-blue-200",
  "Real Estate": "bg-green-100 text-green-700 border-green-200",
  "Supplier": "bg-orange-100 text-orange-700 border-orange-200",
};

export default function Organisations() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedOrganisation, setSelectedOrganisation] = useState(null);
  const [editingOrganisation, setEditingOrganisation] = useState(null);
  const queryClient = useQueryClient();

  const { data: organisations = [], isLoading } = useQuery({
    queryKey: ['organisations'],
    queryFn: () => base44.entities.Organisation.filter({ deleted_at: { $exists: false } })
  });

  const { data: allCustomers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.filter({ deleted_at: { $exists: false } })
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Organisation.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organisations'] });
      setShowForm(false);
      setEditingOrganisation(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Organisation.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organisations'] });
      setShowForm(false);
      setEditingOrganisation(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Organisation.update(id, { deleted_at: new Date().toISOString() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organisations'] });
      setSelectedOrganisation(null);
    }
  });

  const handleSubmit = (data) => {
    if (editingOrganisation) {
      updateMutation.mutate({ id: editingOrganisation.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (organisation) => {
    setEditingOrganisation(organisation);
    setSelectedOrganisation(null);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    deleteMutation.mutate(id);
  };

  const filteredOrganisations = organisations.filter(org =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.organisation_type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCustomerCount = (orgId) => {
    return allCustomers.filter(c => c.organisation_id === orgId).length;
  };

  if (showForm) {
    return (
      <OrganisationForm
        organisation={editingOrganisation}
        onSubmit={handleSubmit}
        onCancel={() => {
          setShowForm(false);
          setEditingOrganisation(null);
        }}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />
    );
  }

  if (selectedOrganisation) {
    return (
      <OrganisationDetails
        organisation={selectedOrganisation}
        onClose={() => setSelectedOrganisation(null)}
        onEdit={() => handleEdit(selectedOrganisation)}
        onDelete={() => handleDelete(selectedOrganisation.id)}
      />
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[#fae008] rounded-xl flex items-center justify-center shadow-md">
            <Building2 className="w-6 h-6 text-[#000000]" />
          </div>
          <h1 className="text-3xl font-bold text-[#000000] tracking-tight">Organisations</h1>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="bg-[#fae008] hover:bg-[#e5d007] text-[#000000] font-bold shadow-md hover:shadow-lg transition-all"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Organisation
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <Input
            placeholder="Search organisations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse rounded-2xl">
              <CardContent className="p-6">
                <div className="h-6 bg-slate-200 rounded w-1/3 mb-4"></div>
                <div className="h-4 bg-slate-200 rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredOrganisations.length === 0 ? (
        <Card className="p-12 text-center rounded-2xl border-2 border-slate-200">
          <Building2 className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-[#000000] mb-2">No organisations found</h3>
          <p className="text-slate-600 mb-4">
            {searchTerm ? 'Try adjusting your search' : 'Get started by creating your first organisation'}
          </p>
          {!searchTerm && (
            <Button
              onClick={() => setShowForm(true)}
              className="bg-[#fae008] hover:bg-[#e5d007] text-[#000000] font-bold"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Organisation
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredOrganisations.map((org) => (
            <Card
              key={org.id}
              className="hover:shadow-lg transition-all cursor-pointer border-2 border-slate-200 rounded-2xl group"
              onClick={() => setSelectedOrganisation(org)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-xl font-bold text-[#000000] group-hover:text-blue-600 transition-colors tracking-tight">
                        {org.name}
                      </h3>
                      <Badge className={`${organisationTypeColors[org.organisation_type]} font-semibold border-2`}>
                        {org.organisation_type}
                      </Badge>
                      {org.status === 'inactive' && (
                        <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300">
                          Inactive
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-2 text-sm">
                      {org.address && (
                        <div className="flex items-start gap-2 text-slate-600">
                          <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                          <span>{org.address}</span>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-4">
                        {org.phone && (
                          <div className="flex items-center gap-2 text-slate-600">
                            <Phone className="w-4 h-4 text-slate-400" />
                            <span>{org.phone}</span>
                          </div>
                        )}
                        {org.email && (
                          <div className="flex items-center gap-2 text-slate-600">
                            <Mail className="w-4 h-4 text-slate-400" />
                            <span>{org.email}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-slate-600 pt-2">
                        <Users className="w-4 h-4 text-slate-400" />
                        <span className="font-semibold">{getCustomerCount(org.id)} customer{getCustomerCount(org.id) !== 1 ? 's' : ''}</span>
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
  );
}