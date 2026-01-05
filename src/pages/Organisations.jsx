import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Search, Plus, Phone, Mail, MapPin, Users, Hash, Eye, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import OrganisationForm from "../components/organisations/OrganisationForm";
import OrganisationDetails from "../components/organisations/OrganisationDetails";
import EntityModal from "../components/common/EntityModal.jsx";
import OrganisationModalView from "../components/organisations/OrganisationModalView";
import { createPageUrl } from "@/utils";
import BackButton from "../components/common/BackButton";
import { OrganisationTypeBadge } from "../components/common/StatusBadge";
import { DuplicateBadge } from "../components/common/DuplicateWarningCard";
import { Checkbox } from "@/components/ui/checkbox";

export default function Organisations() {
  const [searchTerm, setSearchTerm] = useState("");
  const [organisationTypeFilter, setOrganisationTypeFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [selectedOrganisation, setSelectedOrganisation] = useState(null);
  const [editingOrganisation, setEditingOrganisation] = useState(null);
  const [modalOrganisation, setModalOrganisation] = useState(null);
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const queryClient = useQueryClient();

  const { data: allOrganisations = [], isLoading, refetch } = useQuery({
    queryKey: ['organisations'],
    queryFn: () => base44.entities.Organisation.list(),
    refetchInterval: 15000,
  });

  const organisations = allOrganisations;

  const { data: allCustomers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.filter({ deleted_at: { $exists: false } })
  });

  // Handle URL params for direct navigation
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const organisationId = params.get('organisationId');
    
    if (organisationId && organisations.length > 0 && !selectedOrganisation) {
      const organisation = organisations.find((o) => o.id === organisationId);
      if (organisation) {
        setSelectedOrganisation(organisation);
      }
    }
  }, [organisations, selectedOrganisation]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Organisation.create(data),
    onSuccess: (newOrg) => {
      queryClient.setQueryData(['organisations'], (old) => [newOrg, ...(old || [])]);
      queryClient.invalidateQueries({ queryKey: ['organisations'] });
      setShowForm(false);
      setEditingOrganisation(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Organisation.update(id, data),
    onSuccess: (updatedOrg) => {
      queryClient.setQueryData(['organisations'], (old) => 
        (old || []).map(org => org.id === updatedOrg.id ? updatedOrg : org)
      );
      queryClient.invalidateQueries({ queryKey: ['organisations'] });
      setShowForm(false);
      setEditingOrganisation(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Organisation.update(id, { deleted_at: new Date().toISOString() }),
    onSuccess: (updatedOrg, deletedId) => {
      queryClient.setQueryData(['organisations'], (old) => 
        (old || []).filter(org => org.id !== deletedId)
      );
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

  const handleOpenFullOrganisation = (organisation) => {
    setModalOrganisation(null);
    setSelectedOrganisation(organisation);
  };

  const filteredOrganisations = organisations.filter(org => {
    // Filter out deleted
    if (org.deleted_at) return false;
    const matchesSearch = 
      org.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      org.organisation_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      org.sp_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = organisationTypeFilter === "all" || org.organisation_type === organisationTypeFilter;
    
    const matchesDuplicateFilter = !showDuplicatesOnly || org.is_potential_duplicate;
    
    return matchesSearch && matchesType && matchesDuplicateFilter;
  });

  const getCustomerCount = (orgId, orgName) => {
    const matchedCustomers = allCustomers.filter(c => 
      c.organisation_id === orgId || 
      (c.organisation_name && orgName && c.organisation_name.toLowerCase() === orgName.toLowerCase())
    );
    
    console.log(`Counting customers for org ${orgName} (${orgId}):`, {
      totalCustomers: allCustomers.length,
      matchedCount: matchedCustomers.length,
      matched: matchedCustomers.map(c => ({ name: c.name, org_id: c.organisation_id, org_name: c.organisation_name }))
    });
    
    return matchedCustomers.length;
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
    <div className="p-4 md:p-5 lg:p-10 bg-[#ffffff] min-h-screen overflow-x-hidden">
      <div className="max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-4">
          <BackButton to={createPageUrl("Dashboard")} />
        </div>
        <div className="flex flex-col md:flex-row justify-between items-center w-full py-3 lg:py-4 mb-4 lg:mb-6 gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#111827] leading-tight">Organisations</h1>
            <p className="text-sm text-[#4B5563] mt-1">Manage all organisations</p>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold w-full md:w-auto h-10 px-4 text-[14px] rounded-lg"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Organisation
          </Button>
        </div>

        <div className="flex flex-col gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#6B7280] w-5 h-5" />
            <Input
              placeholder="Search organisations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 border border-[#E5E7EB] focus:border-[#FAE008] focus:ring-2 focus:ring-[#FAE008]/20 transition-all h-12 text-base rounded-lg"
            />
          </div>

          <div className="chip-container -mx-4 px-4 md:mx-0 md:px-0">
            <Tabs value={organisationTypeFilter} onValueChange={setOrganisationTypeFilter} className="w-full">
              <TabsList className="w-full justify-start min-w-max md:min-w-0">
                <TabsTrigger value="all" className="flex-1 whitespace-nowrap">All Organisations</TabsTrigger>
                <TabsTrigger value="Strata" className="flex-1 whitespace-nowrap">Strata</TabsTrigger>
                <TabsTrigger value="Builder" className="flex-1 whitespace-nowrap">Builder</TabsTrigger>
                <TabsTrigger value="Real Estate" className="flex-1 whitespace-nowrap">Real Estate</TabsTrigger>
                <TabsTrigger value="Supplier" className="flex-1 whitespace-nowrap">Supplier</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="org-duplicates-filter"
              checked={showDuplicatesOnly}
              onCheckedChange={setShowDuplicatesOnly}
            />
            <label
              htmlFor="org-duplicates-filter"
              className="text-sm text-[#4B5563] cursor-pointer flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-[#D97706]" />
              Show only potential duplicates
            </label>
          </div>
        </div>

      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse rounded-xl border border-[#E5E7EB]">
              <CardContent className="p-6">
                <div className="h-6 bg-gray-100 rounded w-1/3 mb-4"></div>
                <div className="h-4 bg-gray-100 rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredOrganisations.length === 0 ? (
        <Card className="p-12 text-center rounded-xl border border-[#E5E7EB]">
          <Building2 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-[18px] font-semibold text-[#111827] leading-[1.2] mb-2">No organisations found</h3>
          <p className="text-[14px] text-[#6B7280] leading-[1.4] mb-4">
            {searchTerm ? 'Try adjusting your search' : 'Get started by creating your first organisation'}
          </p>
          {!searchTerm && (
            <Button
              onClick={() => setShowForm(true)}
              className="bg-[#fae008] hover:bg-[#e5d007] text-[hsl(25,10%,12%)] font-bold"
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
              className="hover:shadow-md transition-all duration-200 cursor-pointer hover:border-[#FAE008] border border-[#E5E7EB] rounded-xl relative"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedOrganisation(org);
              }}
            >
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-3 right-3 h-8 w-8 rounded-lg hover:bg-[#F3F4F6] z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setModalOrganisation(org);
                }}
              >
                <Eye className="w-4 h-4 text-[#6B7280]" />
              </Button>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 pr-10">
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="text-[18px] font-semibold text-[#111827]">
                        {org.name}
                      </h3>
                      <DuplicateBadge record={org} size="sm" />
                      {org.organisation_type && (
                        <OrganisationTypeBadge value={org.organisation_type} />
                      )}
                      {org.status === 'inactive' && (
                        <Badge variant="outline" className="text-[11px]">
                          Inactive
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-2 text-[14px]">
                      {org.organisation_type === "Strata" && org.sp_number && (
                        <div className="flex items-start gap-2 text-[#6B7280]">
                          <Hash className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span>SP: {org.sp_number}</span>
                        </div>
                      )}
                      {org.address && (
                        <div className="flex items-start gap-2 text-[#6B7280]">
                          <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span>{org.address}</span>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-4">
                        {org.phone && (
                          <div className="flex items-center gap-2 text-[#6B7280]">
                            <Phone className="w-4 h-4" />
                            <span>{org.phone}</span>
                          </div>
                        )}
                        {org.email && (
                          <div className="flex items-center gap-2 text-[#6B7280]">
                            <Mail className="w-4 h-4" />
                            <span>{org.email}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[#6B7280] pt-1">
                        <Users className="w-4 h-4" />
                        <span className="text-[14px] font-medium">{getCustomerCount(org.id, org.name)} customer{getCustomerCount(org.id, org.name) !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <EntityModal
        open={!!modalOrganisation}
        onClose={() => setModalOrganisation(null)}
        title={modalOrganisation?.name || "Organisation"}
        onOpenFullPage={() => handleOpenFullOrganisation(modalOrganisation)}
        fullPageLabel="Open Full Organisation"
      >
        {modalOrganisation && (
          <OrganisationModalView 
            organisation={modalOrganisation} 
            customerCount={getCustomerCount(modalOrganisation.id, modalOrganisation.name)}
          />
        )}
      </EntityModal>
      </div>
    </div>
  );
}