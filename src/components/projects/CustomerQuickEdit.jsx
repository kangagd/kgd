import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Check, X, Phone, Mail, Building2, Users, Plus, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import AddressAutocomplete from "../common/AddressAutocomplete";
import MergeCustomersModal from "../customers/MergeCustomersModal";

export default function CustomerQuickEdit({ customerId, projectId, onCustomerUpdate }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({});
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeData, setMergeData] = useState(null);
  const [isMerging, setIsMerging] = useState(false);
  const [showNewOrgDialog, setShowNewOrgDialog] = useState(false);
  const [orgSearchTerm, setOrgSearchTerm] = useState("");
  const [showChangeCustomerDialog, setShowChangeCustomerDialog] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [isChangingCustomer, setIsChangingCustomer] = useState(false);
  const [newOrgData, setNewOrgData] = useState({
    name: "",
    organisation_type: undefined,
    address_full: "",
    address_street: "",
    address_suburb: "",
    address_state: "",
    address_postcode: "",
    address_country: "Australia",
    google_place_id: "",
    latitude: null,
    longitude: null
  });
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);

  const { data: customer, isLoading, isError } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => base44.entities.Customer.get(customerId),
    enabled: !!customerId,
    retry: false
  });

  const { data: organisations = [] } = useQuery({
    queryKey: ['organisations'],
    queryFn: async () => {
      const orgs = await base44.entities.Organisation.list();
      return orgs.filter(org => org.status === 'active' && !org.deleted_at);
    }
  });

  const { data: allCustomers = [] } = useQuery({
    queryKey: ['allCustomers'],
    queryFn: async () => {
      try {
        const customers = await base44.entities.Customer.list('-updated_date', 500);
        return customers.filter(c => c.status === 'active' && !c.deleted_at);
      } catch (error) {
        console.error('Error fetching customers:', error);
        toast.error('Failed to load customers');
        return [];
      }
    },
    enabled: showChangeCustomerDialog
  });

  const filteredOrganisations = organisations.filter(org => 
    org.name?.toLowerCase().includes(orgSearchTerm.toLowerCase()) ||
    org.organisation_type?.toLowerCase().includes(orgSearchTerm.toLowerCase())
  );

  const filteredCustomers = allCustomers.filter(c => 
    c.id !== customerId && (
      c.name?.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
      c.email?.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
      c.phone?.includes(customerSearchTerm)
    )
  );

  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name || "",
        customer_type: customer.customer_type || "",
        source: customer.source || "",
        source_details: customer.source_details || "",
        phone: customer.phone || "",
        secondary_phone: customer.secondary_phone || "",
        email: customer.email || "",
        organisation_id: customer.organisation_id || "",
        organisation_name: customer.organisation_name || "",
        notes: customer.notes || ""
      });
    }
  }, [customer]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Update customer via backend function (handles duplicates and project syncing)
      const response = await base44.functions.invoke('updateCustomerInfo', {
        customerId,
        data: formData
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['allCustomers'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });

      if (onCustomerUpdate) {
        onCustomerUpdate(formData);
      }

      toast.success('Customer updated');
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating customer:', error);
      
      // Check if this is a duplicate error (409)
      if (error.response?.status === 409 && error.response?.data?.duplicates) {
        // Show merge modal
        setMergeData({
          primaryCustomer: { ...formData, id: customerId },
          duplicateCustomers: error.response.data.duplicates
        });
        setShowMergeModal(true);
      } else {
        toast.error(error.message || 'Failed to update customer');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleMergeCustomers = async (primaryCustomerId, duplicateCustomerId) => {
    setIsMerging(true);
    try {
      const response = await base44.functions.invoke('mergeCustomers', {
        primary_customer_id: duplicateCustomerId, // Use existing as primary
        duplicate_customer_id: primaryCustomerId, // Merge current into existing
        merge_data: true
      });
      
      await queryClient.refetchQueries({ queryKey: ['customers'] });
      await queryClient.refetchQueries({ queryKey: ['customer', duplicateCustomerId] });
      await queryClient.refetchQueries({ queryKey: ['project', projectId] });
      await queryClient.refetchQueries({ queryKey: ['projects'] });
      
      // Update project to use the existing customer
      await base44.functions.invoke('manageProject', {
        action: 'update',
        id: projectId,
        data: {
          customer_id: duplicateCustomerId
        }
      });
      
      await queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      
      setShowMergeModal(false);
      setIsEditing(false);
      setMergeData(null);
      
      toast.success(response.data.message || 'Customers merged successfully');
      
      if (onCustomerUpdate) {
        onCustomerUpdate({ customer_id: duplicateCustomerId });
      }
    } catch (error) {
      console.error('Merge error:', error);
      toast.error(`Failed to merge: ${error.message}`);
    } finally {
      setIsMerging(false);
    }
  };

  const handleCancel = () => {
    if (customer) {
      setFormData({
        name: customer.name || "",
        customer_type: customer.customer_type || "",
        source: customer.source || "",
        source_details: customer.source_details || "",
        phone: customer.phone || "",
        secondary_phone: customer.secondary_phone || "",
        email: customer.email || "",
        organisation_id: customer.organisation_id || "",
        organisation_name: customer.organisation_name || "",
        notes: customer.notes || ""
      });
    }
    setIsEditing(false);
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

  const handleChangeCustomer = async (newCustomerId) => {
    setIsChangingCustomer(true);
    try {
      const newCustomer = allCustomers.find(c => c.id === newCustomerId);
      if (!newCustomer) {
        toast.error('Customer not found');
        return;
      }

      // Update project with new customer
      await base44.functions.invoke('manageProject', {
        action: 'update',
        id: projectId,
        data: {
          customer_id: newCustomerId,
          customer_name: newCustomer.name,
          customer_phone: newCustomer.phone,
          customer_email: newCustomer.email
        }
      });

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customer', newCustomerId] });

      setShowChangeCustomerDialog(false);
      setCustomerSearchTerm("");
      toast.success('Customer changed successfully');
      
      if (onCustomerUpdate) {
        onCustomerUpdate({ customer_id: newCustomerId });
      }
    } catch (error) {
      console.error('Error changing customer:', error);
      toast.error('Failed to change customer');
    } finally {
      setIsChangingCustomer(false);
    }
  };

  const handleCreateOrganisation = async () => {
    if (!newOrgData.name?.trim()) return;
    
    setIsCreatingOrg(true);
    try {
      const submitData = {
        name: newOrgData.name.trim(),
        status: 'active'
      };
      
      if (newOrgData.organisation_type) {
        submitData.organisation_type = newOrgData.organisation_type;
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
      
      // Immediately update the cache with the new organisation
      queryClient.setQueryData(['organisations'], (old = []) => [...old, newOrg]);
      
      setShowNewOrgDialog(false);
      setFormData(prev => ({
        ...prev,
        organisation_id: newOrg.id,
        organisation_name: newOrg.name
      }));
      
      setNewOrgData({
        name: "",
        organisation_type: undefined,
        address_full: "",
        address_street: "",
        address_suburb: "",
        address_state: "",
        address_postcode: "",
        address_country: "Australia",
        google_place_id: "",
        latitude: null,
        longitude: null
      });
      
      toast.success('Organisation created');
    } catch (error) {
      console.error("Error creating organisation:", error);
      toast.error("Failed to create organisation");
    } finally {
      setIsCreatingOrg(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-6 bg-[#F3F4F6] rounded w-3/4"></div>
        <div className="h-4 bg-[#F3F4F6] rounded w-1/2"></div>
      </div>
    );
  }

  if (isError || !customer) {
    return (
      <div className="space-y-3">
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="text-[14px] font-medium text-red-700 mb-1">Customer Not Found</div>
          <div className="text-[13px] text-red-600">
            This customer record may have been deleted. Please select a different customer for this project.
          </div>
        </div>
      </div>
    );
  }

  if (!isEditing) {
    return (
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <h2 className="text-[22px] font-semibold text-[#111827] leading-[1.2]">{customer.name}</h2>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setShowChangeCustomerDialog(true);
              }}
              className="h-8 w-8 hover:bg-[#F3F4F6] text-[#6B7280] hover:text-[#111827]"
              title="Change customer"
            >
              <Users className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              className="h-8 w-8 hover:bg-[#F3F4F6] text-[#6B7280] hover:text-[#111827]"
            >
              <Edit className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {customer.customer_type && (
          <span className="inline-block bg-[#EDE9FE] text-[#6D28D9] font-medium px-2.5 py-0.5 rounded-lg text-[12px]">
            {customer.customer_type}
          </span>
        )}

        {customer.organisation_name && (
          <div className="flex items-center gap-2 text-[14px] text-[#4B5563]">
            <Building2 className="w-4 h-4" />
            <span>{customer.organisation_name}</span>
          </div>
        )}

        {customer.source && (
          <div className="flex items-center gap-2 text-[14px] text-[#4B5563]">
            <Users className="w-4 h-4" />
            <span>
              {customer.source}
              {customer.source_details && (
                <span className="text-[#6B7280]"> — {customer.source_details}</span>
              )}
            </span>
          </div>
        )}

        <div className="space-y-2 pt-2">
          {customer.phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-[#6B7280]" />
              <a href={`tel:${customer.phone}`} className="text-[14px] text-[#111827] hover:text-[#FAE008]">
                {customer.phone}
              </a>
            </div>
          )}
          {customer.secondary_phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-[#6B7280]" />
              <a href={`tel:${customer.secondary_phone}`} className="text-[14px] text-[#6B7280] hover:text-[#FAE008]">
                {customer.secondary_phone} (secondary)
              </a>
            </div>
          )}
          {customer.email && (
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#6B7280]" />
              <a href={`mailto:${customer.email}`} className="text-[14px] text-[#111827] hover:text-[#FAE008] break-all">
                {customer.email}
              </a>
            </div>
          )}
        </div>

        {/* Show missing fields hint */}
        {(!customer.phone || !customer.email || !customer.customer_type) && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-[12px] text-[#D97706] hover:underline"
          >
            + Add missing details
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[14px] font-medium text-[#111827]">Edit Customer</span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCancel}
            disabled={isSaving}
            className="h-7 w-7 hover:bg-red-50 text-[#6B7280] hover:text-red-600"
          >
            <X className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSave}
            disabled={isSaving}
            className="h-7 w-7 hover:bg-green-50 text-[#6B7280] hover:text-green-600"
          >
            <Check className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-[12px] text-[#6B7280]">Name *</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="h-9 text-[14px]"
          />
        </div>

        <div>
          <Label className="text-[12px] text-[#6B7280]">Type</Label>
          <Select
            value={formData.customer_type || "none"}
            onValueChange={(val) => setFormData({ ...formData, customer_type: val === "none" ? "" : val })}
          >
            <SelectTrigger className="h-9 text-[14px]">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="Owner">Owner</SelectItem>
              <SelectItem value="Builder">Builder</SelectItem>
              <SelectItem value="Real Estate - Tenant">Real Estate - Tenant</SelectItem>
              <SelectItem value="Real Estate - Agent">Real Estate - Agent</SelectItem>
              <SelectItem value="Strata - Owner">Strata - Owner</SelectItem>
              <SelectItem value="Strata - Agent">Strata - Agent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-[12px] text-[#6B7280]">Organisation</Label>
          <div className="flex gap-2">
            <Select
              value={formData.organisation_id || "none"}
              onValueChange={handleOrganisationChange}
            >
              <SelectTrigger className="h-9 text-[14px] flex-1">
                <SelectValue placeholder="Select organisation">
                  {formData.organisation_id && formData.organisation_id !== "none" 
                    ? formData.organisation_name || organisations.find(o => o.id === formData.organisation_id)?.name
                    : "None"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 py-1.5 border-b">
                  <Input
                    placeholder="Search organisations..."
                    value={orgSearchTerm}
                    onChange={(e) => setOrgSearchTerm(e.target.value)}
                    className="h-8 text-[13px]"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <SelectItem value="none">None</SelectItem>
                {filteredOrganisations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}{org.organisation_type ? ` (${org.organisation_type})` : ''}
                  </SelectItem>
                ))}
                {filteredOrganisations.length === 0 && orgSearchTerm && (
                  <div className="px-2 py-6 text-center text-[13px] text-[#6B7280]">
                    No organisations found
                  </div>
                )}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowNewOrgDialog(true)}
              className="h-9 w-9 flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div>
          <Label className="text-[12px] text-[#6B7280]">Source</Label>
          <Select
            value={formData.source || "none"}
            onValueChange={(val) => setFormData({ ...formData, source: val === "none" ? "" : val, source_details: "" })}
          >
            <SelectTrigger className="h-9 text-[14px]">
              <SelectValue placeholder="How did they find us?" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
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
          <div>
            <Label className="text-[12px] text-[#6B7280]">Referring Customer</Label>
            <Input
              value={formData.source_details}
              onChange={(e) => setFormData({ ...formData, source_details: e.target.value })}
              className="h-9 text-[14px]"
              placeholder="Referring customer"
            />
          </div>
        )}

        {formData.source === "Other" && (
          <div>
            <Label className="text-[12px] text-[#6B7280]">Source Details</Label>
            <Input
              value={formData.source_details}
              onChange={(e) => setFormData({ ...formData, source_details: e.target.value })}
              className="h-9 text-[14px]"
              placeholder="Please specify"
            />
          </div>
        )}

        <div>
          <Label className="text-[12px] text-[#6B7280]">Phone</Label>
          <Input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="h-9 text-[14px]"
            placeholder="Primary phone"
          />
        </div>

        <div>
          <Label className="text-[12px] text-[#6B7280]">Secondary Phone</Label>
          <Input
            type="tel"
            value={formData.secondary_phone}
            onChange={(e) => setFormData({ ...formData, secondary_phone: e.target.value })}
            className="h-9 text-[14px]"
            placeholder="Secondary phone"
          />
        </div>

        <div>
          <Label className="text-[12px] text-[#6B7280]">Email</Label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="h-9 text-[14px]"
            placeholder="Email address"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button
          onClick={handleSave}
          disabled={isSaving || !formData.name}
          className="flex-1 h-9 bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold text-[14px]"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          onClick={handleCancel}
          disabled={isSaving}
          variant="outline"
          className="h-9 text-[14px]"
        >
          Cancel
        </Button>
      </div>

      <Dialog open={showNewOrgDialog} onOpenChange={setShowNewOrgDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">New Organisation</DialogTitle>
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
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_org_address">Address</Label>
              <AddressAutocomplete
                id="new_org_address"
                value={newOrgData.address_full || ""}
                onChange={(addressData) => setNewOrgData({ 
                  ...newOrgData, 
                  ...addressData
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
              onClick={handleCreateOrganisation}
              disabled={!newOrgData.name || isCreatingOrg}
              className="bg-[#fae008] hover:bg-[#e5d007] text-[#000000] font-bold"
            >
              {isCreatingOrg ? 'Creating...' : 'Create Organisation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MergeCustomersModal
        open={showMergeModal}
        onClose={() => {
          setShowMergeModal(false);
          setMergeData(null);
        }}
        primaryCustomer={mergeData?.primaryCustomer}
        duplicateCustomers={mergeData?.duplicateCustomers}
        onMerge={handleMergeCustomers}
        isSubmitting={isMerging}
      />

      <Dialog open={showChangeCustomerDialog} onOpenChange={setShowChangeCustomerDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Change Customer</DialogTitle>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
            <Input
              placeholder="Search customers by name, email, or phone..."
              value={customerSearchTerm}
              onChange={(e) => setCustomerSearchTerm(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 min-h-[300px]">
            {filteredCustomers.length === 0 ? (
              <div className="text-center py-12 text-[#9CA3AF]">
                <Users className="w-12 h-12 mx-auto mb-3 text-[#E5E7EB]" />
                <p className="text-[14px]">
                  {customerSearchTerm ? 'No customers found' : 'Start typing to search customers'}
                </p>
              </div>
            ) : (
              filteredCustomers.slice(0, 20).map(cust => (
                <button
                  key={cust.id}
                  onClick={() => handleChangeCustomer(cust.id)}
                  disabled={isChangingCustomer}
                  className="w-full text-left p-3 rounded-lg border border-[#E5E7EB] hover:border-[#FAE008] hover:bg-[#FFFEF5] transition-all"
                >
                  <div className="font-medium text-[14px] text-[#111827] mb-1">
                    {cust.name}
                  </div>
                  {cust.customer_type && (
                    <div className="text-[12px] text-[#6B7280] mb-1">
                      {cust.customer_type}
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-[12px] text-[#9CA3AF]">
                    {cust.phone && <span>{cust.phone}</span>}
                    {cust.email && <span>{cust.email}</span>}
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#E5E7EB]">
            <Button variant="outline" onClick={() => setShowChangeCustomerDialog(false)} disabled={isChangingCustomer}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}