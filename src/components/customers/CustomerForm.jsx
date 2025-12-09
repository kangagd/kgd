import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
// Removed Textarea import as it's replaced by RichTextEditor for notes
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, AlertTriangle } from "lucide-react";
import RichTextField from "../common/RichTextField";
import { Checkbox } from "@/components/ui/checkbox";
import AddressAutocomplete from "../common/AddressAutocomplete";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import _ from "lodash";

export default function CustomerForm({ customer, onSubmit, onCancel, isSubmitting }) {
  const [formData, setFormData] = useState(customer || {
    name: "",
    customer_type: "",
    source: "",
    source_details: "",
    phone: "",
    email: "",
    secondary_phone: "",
    address: "",
    address_full: "",
    address_street: "",
    address_suburb: "",
    address_state: "",
    address_postcode: "",
    address_country: "Australia",
    google_place_id: "",
    latitude: null,
    longitude: null,
    notes: "",
    status: "active",
    organisation_id: "",
    organisation_name: "",
    is_station: false,
    contract_id: ""
  });

  const [showNewOrgDialog, setShowNewOrgDialog] = useState(false);
  const [newOrgData, setNewOrgData] = useState({
    name: "",
    organisation_type: undefined,
    sp_number: "",
    address: "", // Legacy field for backward compatibility
    address_full: "",
    address_street: "",
    address_suburb: "",
    address_state: "",
    address_postcode: "",
    address_country: "Australia",
    google_place_id: "",
    latitude: null,
    longitude: null,
  });
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [orgTypeFilter, setOrgTypeFilter] = useState("all");
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const queryClient = useQueryClient();

  const { data: allOrganisations = [] } = useQuery({
    queryKey: ['organisations'],
    queryFn: () => base44.entities.Organisation.list()
  });

  const organisations = allOrganisations.filter(org => !org.deleted_at && org.status === 'active');

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list()
  });

  // Debounced duplicate check
  const checkDuplicates = useCallback(
    _.debounce(async (data) => {
      if (!data.name && !data.email && !data.phone) {
        setDuplicateWarning(null);
        return;
      }
      
      setIsCheckingDuplicates(true);
      try {
        const result = await base44.functions.invoke('checkDuplicates', {
          entity_type: 'Customer',
          record: data,
          exclude_id: customer?.id
        });
        
        if (result.data?.is_potential_duplicate && result.data?.matches?.length > 0) {
          setDuplicateWarning(result.data);
        } else {
          setDuplicateWarning(null);
        }
      } catch (error) {
        console.error('Error checking duplicates:', error);
      } finally {
        setIsCheckingDuplicates(false);
      }
    }, 500),
    [customer?.id]
  );

  // Check for duplicates when key fields change
  useEffect(() => {
    checkDuplicates(formData);
    return () => checkDuplicates.cancel();
  }, [formData.name, formData.email, formData.phone, checkDuplicates]);

  const filteredOrganisations = organisations.filter(org => 
    orgTypeFilter === "all" || org.organisation_type === orgTypeFilter
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleOrganisationChange = (orgId) => {
    if (orgId === "none") {
      setFormData({
        ...formData,
        organisation_id: "",
        organisation_name: ""
      });
    } else {
      const org = organisations.find(o => o.id === orgId);
      setFormData({
        ...formData,
        organisation_id: orgId,
        organisation_name: org?.name || ""
      });
    }
  };

  const handleCreateNewOrg = async () => {
    if (!newOrgData.name?.trim()) return;
    
    setIsCreatingOrg(true);
    try {
      // Build clean submit data
      const submitData = {
        name: newOrgData.name.trim(),
        status: 'active'
      };
      
      if (newOrgData.organisation_type) {
        submitData.organisation_type = newOrgData.organisation_type;
      }
      if (newOrgData.sp_number?.trim()) {
        submitData.sp_number = newOrgData.sp_number.trim();
      }
      if (newOrgData.address_full) {
        submitData.address_full = newOrgData.address_full;
        submitData.address = newOrgData.address_full;
        submitData.address_street = newOrgData.address_street;
        submitData.address_suburb = newOrgData.address_suburb;
        submitData.address_state = newOrgData.address_state;
        submitData.address_postcode = newOrgData.address_postcode;
        submitData.address_country = newOrgData.address_country || "Australia";
        submitData.google_place_id = newOrgData.google_place_id;
        submitData.latitude = newOrgData.latitude;
        submitData.longitude = newOrgData.longitude;
      }
      
      const newOrg = await base44.entities.Organisation.create(submitData);
      
      // Close dialog first
      setShowNewOrgDialog(false);
      
      // Update form data with new organisation immediately
      setFormData(prev => ({
        ...prev,
        organisation_id: newOrg.id,
        organisation_name: newOrg.name
      }));
      
      // Reset org form
      setNewOrgData({
        name: "",
        organisation_type: undefined,
        sp_number: "",
        address: "",
        address_full: "",
        address_street: "",
        address_suburb: "",
        address_state: "",
        address_postcode: "",
        address_country: "Australia",
        google_place_id: "",
        latitude: null,
        longitude: null,
      });
      
      // Invalidate queries to refresh list in background
      queryClient.invalidateQueries({ queryKey: ['organisations'] });
      
    } catch (error) {
      console.error("Error creating organisation:", error);
      alert("Failed to create organisation. Please try again.");
    } finally {
      setIsCreatingOrg(false);
    }
  };

  return (
    <>
      <Card className="border-none shadow-lg">
        <CardHeader className="border-b border-slate-100">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <CardTitle className="text-2xl font-bold">
              {customer ? 'Edit Customer' : 'New Customer'}
            </CardTitle>
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Customer Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            {/* Duplicate Warning */}
            {duplicateWarning && duplicateWarning.matches?.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-amber-800 text-sm mb-2">
                      Potential duplicate{duplicateWarning.matches.length > 1 ? 's' : ''} found
                    </h4>
                    <div className="space-y-2">
                      {duplicateWarning.matches.slice(0, 3).map((match) => (
                        <div key={match.id} className="flex items-center justify-between bg-white rounded-md p-2 border border-amber-100">
                          <div className="text-sm">
                            <span className="font-medium text-[#111827]">{match.name}</span>
                            {match.email && <span className="text-[#6B7280] ml-2">• {match.email}</span>}
                            {match.phone && <span className="text-[#6B7280] ml-2">• {match.phone}</span>}
                            <span className="text-amber-600 ml-2 text-xs">
                              (Match: {match.match_reasons?.join(', ')})
                            </span>
                          </div>
                          <Link
                            to={`${createPageUrl('Customers')}?customerId=${match.id}`}
                            className="text-xs text-amber-700 hover:text-amber-900 underline ml-2"
                            target="_blank"
                          >
                            View
                          </Link>
                        </div>
                      ))}
                      {duplicateWarning.matches.length > 3 && (
                        <p className="text-xs text-amber-600">
                          +{duplicateWarning.matches.length - 3} more potential match{duplicateWarning.matches.length - 3 > 1 ? 'es' : ''}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="organisation_id">Organisation (Optional)</Label>
              <div className="flex gap-2 mb-2">
                <Select value={orgTypeFilter} onValueChange={setOrgTypeFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="Strata">Strata</SelectItem>
                    <SelectItem value="Builder">Builder</SelectItem>
                    <SelectItem value="Real Estate">Real Estate</SelectItem>
                    <SelectItem value="Supplier">Supplier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Select value={formData.organisation_id || "none"} onValueChange={handleOrganisationChange}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select organisation" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {filteredOrganisations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}{org.organisation_type ? ` (${org.organisation_type})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewOrgDialog(true)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer_type">Customer Type</Label>
              <Select value={formData.customer_type} onValueChange={(val) => setFormData({ ...formData, customer_type: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Owner">Owner</SelectItem>
                  <SelectItem value="Builder">Builder</SelectItem>
                  <SelectItem value="Real Estate - Tenant">Real Estate - Tenant</SelectItem>
                  <SelectItem value="Real Estate - Agent">Real Estate - Agent</SelectItem>
                  <SelectItem value="Strata - Owner">Strata - Owner</SelectItem>
                  <SelectItem value="Strata - Agent">Strata - Agent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Select value={formData.source || ""} onValueChange={(val) => setFormData({ ...formData, source: val, source_details: "" })}>
                <SelectTrigger>
                  <SelectValue placeholder="How did they find us?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Word of mouth">Word of mouth</SelectItem>
                  <SelectItem value="Google">Google</SelectItem>
                  <SelectItem value="Socials">Socials</SelectItem>
                  <SelectItem value="Car/Trailer">Car/Trailer</SelectItem>
                  <SelectItem value="Builder">Builder</SelectItem>
                  <SelectItem value="Real Estate">Real Estate</SelectItem>
                  <SelectItem value="Strata">Strata</SelectItem>
                  <SelectItem value="Gliderol">Gliderol</SelectItem>
                  <SelectItem value="4D">4D</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.source === "Word of mouth" && (
              <div className="space-y-2">
                <Label htmlFor="source_details">Referring Customer</Label>
                <Input
                  id="source_details"
                  value={formData.source_details || ""}
                  onChange={(e) => setFormData({ ...formData, source_details: e.target.value })}
                  placeholder="Referring customer"
                />
              </div>
            )}

            {formData.source === "Other" && (
              <div className="space-y-2">
                <Label htmlFor="source_details">Source Details</Label>
                <Input
                  id="source_details"
                  value={formData.source_details || ""}
                  onChange={(e) => setFormData({ ...formData, source_details: e.target.value })}
                  placeholder="Please specify"
                />
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="phone">Primary Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="secondary_phone">Secondary Phone</Label>
                <Input
                  id="secondary_phone"
                  type="tel"
                  value={formData.secondary_phone}
                  onChange={(e) => setFormData({ ...formData, secondary_phone: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <AddressAutocomplete
                id="address"
                value={formData.address_full || formData.address || ""}
                onChange={(addressData) => setFormData(prev => ({ 
                  ...prev, 
                  ...addressData,
                  address: addressData.address_full // Keep legacy field for backward compatibility
                }))}
                placeholder="Start typing an address..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <RichTextField
              label="Notes"
              value={formData.notes}
              onChange={(value) => setFormData({ ...formData, notes: value })}
              placeholder="Add any notes about the customer…"
              helperText="Internal only"
            />

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_station"
                  checked={formData.is_station}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_station: checked, contract_id: checked ? formData.contract_id : "" })}
                />
                <Label htmlFor="is_station">This is a Station/Site</Label>
              </div>
              {formData.is_station && (
                <div className="space-y-2 ml-7 mt-2">
                  <Label htmlFor="contract_id">Linked Contract</Label>
                  <Select 
                    value={formData.contract_id || "none"}
                    onValueChange={(val) => setFormData({ ...formData, contract_id: val === "none" ? "" : val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a contract (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {contracts.map((contract) => (
                        <SelectItem key={contract.id} value={contract.id}>{contract.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="border-t border-slate-100 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-[#fae008] hover:bg-[#e5d007] active:bg-[#d4c006] text-[#000000] font-bold shadow-md hover:shadow-lg transition-all">
              {isSubmitting ? 'Saving...' : customer ? 'Update Customer' : 'Create Customer'}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Dialog open={showNewOrgDialog} onOpenChange={setShowNewOrgDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#000000]">New Organisation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new_org_name">Name *</Label>
              <Input
                id="new_org_name"
                value={newOrgData.name}
                onChange={(e) => setNewOrgData({ ...newOrgData, name: e.target.value })}
                className="border-2 border-slate-300"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_org_type">Type</Label>
              <Select value={newOrgData.organisation_type || ""} onValueChange={(val) => setNewOrgData({ ...newOrgData, organisation_type: val || undefined })}>
                <SelectTrigger className="border-2 border-slate-300">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Strata">Strata</SelectItem>
                  <SelectItem value="Builder">Builder</SelectItem>
                  <SelectItem value="Real Estate">Real Estate</SelectItem>
                  <SelectItem value="Supplier">Supplier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newOrgData.organisation_type === "Strata" && (
              <div className="space-y-2">
                <Label htmlFor="new_org_sp">SP Number</Label>
                <Input
                  id="new_org_sp"
                  value={newOrgData.sp_number}
                  onChange={(e) => setNewOrgData({ ...newOrgData, sp_number: e.target.value })}
                  placeholder="Strata Plan number"
                  className="border-2 border-slate-300"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="new_org_address">Address</Label>
              <AddressAutocomplete
                id="new_org_address"
                value={newOrgData.address_full || newOrgData.address || ""}
                onChange={(addressData) => setNewOrgData({ 
                  ...newOrgData, 
                  ...addressData, 
                  address: addressData.address_full // Keep legacy field for backward compatibility
                })}
                className="border-2 border-slate-300"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowNewOrgDialog(false)}
              className="border-2 font-semibold"
              disabled={isCreatingOrg}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateNewOrg}
              disabled={!newOrgData.name || isCreatingOrg}
              className="bg-[#fae008] hover:bg-[#e5d007] text-[#000000] font-bold"
            >
              {isCreatingOrg ? 'Creating...' : 'Create Organisation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}