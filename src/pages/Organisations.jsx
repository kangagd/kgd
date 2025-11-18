import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Building2, Search, Plus, Phone, Mail, MapPin, Users, Hash } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import OrganisationForm from "../components/organisations/OrganisationForm";
import OrganisationDetails from "../components/organisations/OrganisationDetails";

const organisationTypeColors = {
  "Strata": "bg-purple-100 text-purple-700 border-purple-200",
  "Builder": "bg-[#FEF8C8] text-slate-700 border-slate-200",
  "Real Estate": "bg-green-100 text-green-700 border-green-200",
  "Supplier": "bg-orange-100 text-orange-700 border-orange-200",
};

export default function Organisations() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedOrganisation, setSelectedOrganisation] = useState(null);
  const [editingOrganisation, setEditingOrganisation] = useState(null);
  const queryClient = useQueryClient();

  const { data: organisations = [], isLoading, refetch } = useQuery({
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
      refetch();
      setShowForm(false);
      setEditingOrganisation(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Organisation.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organisations'] });
      refetch();
      setShowForm(false);
      setEditingOrganisation(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Organisation.update(id, { deleted_at: new Date().toISOString() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organisations'] });
      refetch();
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
    org.organisation_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.sp_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCustomerCount = (orgId) => {
    return allCustomers.filter(c => c.organisation_id === orgId).length;
  };

  if (showForm) {
    return (
      <div className="p-4 md:p-8 bg-[#FFFDEF] min-h-screen">
        <div className="max-w-4xl mx-auto">
          <OrganisationForm
            organisation={editingOrganisation}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingOrganisation(null);
            }}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
          />
        </div>
      </div>
    );
  }

  if (selectedOrganisation) {
    return (
      <div className="p-4 md:p-8 bg-[#FFFDEF] min-h-screen">
        <div className="max-w-4xl mx-auto">
          <OrganisationDetails
            organisation={selectedOrganisation}
            onClose={() => setSelectedOrganisation(null)}
            onEdit={() => handleEdit(selectedOrganisation)}
            onDelete={() => handleDelete(selectedOrganisation.id)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-[#FFFDEF] min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[hsl(25,10%,12%)] tracking-tight">Organisations</h1>
            <p className="text-[hsl(25,8%,45%)] mt-2">Manage organisations and entities</p>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="bg-[#fae008] text-black hover:bg-[#e5d007] active:bg-[#d4c006] font-semibold shadow-md hover:shadow-lg transition-all w-full md:w-auto"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Organisation
          </Button>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[hsl(25,8%,55%)]" />
            <Input
              placeholder="Search organisations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 border-2 border-[hsl(32,15%,88%)] focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all h-12 text-base rounded-xl"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse border-2 border-[hsl(32,15%,88%)] rounded-2xl">
                <CardContent className="p-4 md:p-6">
                  <div className="h-6 bg-[hsl(32,15%,88%)] rounded w-1/3 mb-4"></div>
                  <div className="h-4 bg-[hsl(32,15%,88%)] rounded w-2/3"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredOrganisations.length === 0 ? (
          <Card className="p-12 text-center border-2 border-[hsl(32,15%,88%)] rounded-2xl">
            <Building2 className="w-16 h-16 mx-auto text-[hsl(32,15%,88%)] mb-4" />
            <h3 className="text-lg font-bold text-[hsl(25,10%,12%)] mb-2">No organisations found</h3>
            <p className="text-[hsl(25,8%,45%)] mb-4">
              {searchTerm ? 'Try adjusting your search' : 'Get started by creating your first organisation'}
            </p>
            {!searchTerm && (
              <Button
                onClick={() => setShowForm(true)}
                className="bg-[#fae008] hover:bg-[#e5d007] text-black font-bold"
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
                className="border-2 border-[hsl(32,15%,88%)] hover:border-[#fae008] hover:shadow-lg transition-all cursor-pointer rounded-2xl"
                onClick={() => setSelectedOrganisation(org)}
              >
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <h3 className="text-lg font-bold text-[hsl(25,10%,12%)]">{org.name}</h3>
                        {org.organisation_type && (
                          <Badge className={`${organisationTypeColors[org.organisation_type]} font-semibold border-2`}>
                            {org.organisation_type}
                          </Badge>
                        )}
                        {org.status === 'inactive' && (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 font-semibold border-2">
                            Inactive
                          </Badge>
                        )}
                      </div>

                      {org.organisation_type === "Strata" && org.sp_number && (
                        <div className="flex items-center gap-2 text-sm text-[hsl(25,8%,45%)] mb-2">
                          <Hash className="w-4 h-4" />
                          <span>SP: {org.sp_number}</span>
                        </div>
                      )}

                      {org.address && (
                        <div className="flex items-start gap-2 text-sm text-[hsl(25,8%,45%)] mb-2">
                          <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span>{org.address}</span>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-3 text-sm text-[hsl(25,8%,45%)]">
                        {org.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            <span>{org.phone}</span>
                          </div>
                        )}
                        {org.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            <span>{org.email}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right text-sm text-[hsl(25,8%,45%)]">
                      <div className="font-bold text-[hsl(25,10%,12%)]">{getCustomerCount(org.id)} customer{getCustomerCount(org.id) !== 1 ? 's' : ''}</div>
                      {org.created_date && (
                        <div className="text-xs">Created {new Date(org.created_date).toLocaleDateString()}</div>
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