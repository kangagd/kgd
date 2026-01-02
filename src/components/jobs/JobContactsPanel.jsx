import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Plus, Trash2, Phone, Mail, ExternalLink, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function JobContactsPanel({ job }) {
  const queryClient = useQueryClient();
  const { data: people = [] } = useQuery({
    queryKey: ["people-for-job-contacts"],
    queryFn: () => base44.entities.Customer.list("name"),
  });

  const [newContact, setNewContact] = useState({
    contact_id: "",
    name: "",
    email: "",
    phone: "",
    role: "",
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const { data: jobContacts = [], isLoading: jobContactsLoading } = useQuery({
    queryKey: ["job-contacts", job.id],
    queryFn: () =>
      base44.entities.JobContact.filter({
        job_id: job.id,
      }),
    enabled: !!job?.id,
  });

  const createContactMutation = useMutation({
    mutationFn: async () => {
      if (!job?.id) return;
      
      let finalContactId = newContact.contact_id;
      let finalName = newContact.name;
      let finalEmail = newContact.email;
      let finalPhone = newContact.phone;

      // If no existing contact selected, create a new Customer first
      if (!finalContactId && newContact.name) {
          try {
             // Try to map role to customer_type
             const validTypes = ["Owner", "Builder", "Real Estate - Tenant", "Real Estate - Agent", "Strata - Owner", "Strata - Agent"];
             const mappedType = validTypes.includes(newContact.role) ? newContact.role : undefined;

             const newCustomer = await base44.entities.Customer.create({
                 name: newContact.name,
                 email: newContact.email || undefined,
                 phone: newContact.phone || undefined,
                 customer_type: mappedType,
                 source: "Other",
                 source_details: "Added via Job Contacts",
                 status: "active"
             });
             finalContactId = newCustomer.id;
             finalName = newCustomer.name;
             finalEmail = newCustomer.email || finalEmail;
             finalPhone = newCustomer.phone || finalPhone;
          } catch (e) {
              console.error("Error creating customer:", e);
              throw new Error("Failed to create new customer record: " + e.message);
          }
      } else if (finalContactId) {
          const person = people.find((p) => p.id === finalContactId);
          if (person) {
             finalName = finalName || person.name;
             finalEmail = finalEmail || person.email || "";
             finalPhone = finalPhone || person.phone || "";
          }
      }

      if (!finalName) return;

      await base44.entities.JobContact.create({
        job_id: job.id,
        contact_id: finalContactId || null,
        name: finalName,
        email: finalEmail,
        phone: finalPhone,
        role: newContact.role || "",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["job-contacts", job.id]);
      queryClient.invalidateQueries(["people-for-job-contacts"]);
      setNewContact({
        contact_id: "",
        name: "",
        email: "",
        phone: "",
        role: "",
      });
      toast.success("Contact added");
    },
    onError: (err) => {
        toast.error(err.message || "Failed to add contact");
    }
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (id) => {
      return base44.entities.JobContact.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["job-contacts", job.id]);
      toast.success("Contact deleted");
    },
  });

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-4 border border-[#E5E7EB] rounded-lg bg-white shadow-sm">
      <CollapsibleTrigger className="w-full flex items-center justify-between p-4 hover:bg-[#F9FAFB] transition-colors group">
        <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#111827]" />
            <h2 className="text-sm font-semibold text-[#111827]">Job Contacts</h2>
        </div>
        <div className="flex items-center gap-2">
          {jobContacts?.length > 0 && (
            <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {jobContacts.length} contact{jobContacts.length === 1 ? "" : "s"}
            </span>
          )}
          <ChevronDown className="w-4 h-4 text-[#6B7280] transition-transform group-data-[state=open]:rotate-180" />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4">

      {jobContactsLoading ? (
        <p className="text-xs text-gray-500">Loading contacts…</p>
      ) : !jobContacts?.length ? (
        <p className="text-xs text-gray-500 mb-3 italic">
          No additional contacts yet. Add owners, builders, tenants or strata managers here.
        </p>
      ) : (
        <div className="space-y-2 mb-4">
          {jobContacts.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2 text-xs hover:bg-gray-50 transition-colors"
            >
              <div className="space-y-1">
                <div className="font-medium text-gray-900 flex items-center gap-2">
                  {c.name || "Unnamed contact"}
                  {c.role && (
                    <span className="rounded-md bg-[#FAE008]/20 border border-[#FAE008]/30 px-1.5 py-0.5 text-[10px] font-medium text-[#854D0E]">
                      {c.role}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-gray-500 flex items-center gap-2">
                  {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</span>}
                  {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</span>}
                </div>
                {c.contact_id && (
                  <Link 
                    to={`${createPageUrl("Customers")}?customerId=${c.contact_id}`}
                    className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5"
                  >
                    View contact <ExternalLink className="w-2.5 h-2.5" />
                  </Link>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-gray-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() => deleteContactMutation.mutate(c.id)}
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick add contact */}
      <div className="border-t border-gray-100 pt-3 mt-2">
        <p className="text-[11px] font-medium text-gray-500 mb-2">
          Quick add contact for this job
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
          <div className="relative z-20">
            <Input
              placeholder="Name"
              value={newContact.name}
              onChange={(e) => {
                setNewContact((c) => ({ ...c, name: e.target.value, contact_id: "" }));
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              className="h-8 text-xs"
              autoComplete="off"
            />
            {showSuggestions && newContact.name && !newContact.contact_id && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto py-1">
                {people
                  .filter(p => p.name?.toLowerCase().includes(newContact.name.toLowerCase()))
                  .slice(0, 5)
                  .map(person => (
                    <button
                      key={person.id}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex flex-col"
                      onClick={() => {
                        setNewContact(prev => ({
                          ...prev,
                          contact_id: person.id,
                          name: person.name,
                          email: person.email || prev.email,
                          phone: person.phone || prev.phone,
                        }));
                        setShowSuggestions(false);
                      }}
                    >
                      <span className="font-medium text-gray-900">{person.name}</span>
                      {(person.email || person.phone) && (
                        <span className="text-gray-500 text-[10px]">
                          {person.email} {person.phone && `• ${person.phone}`}
                        </span>
                      )}
                    </button>
                  ))}
                 {people.filter(p => p.name?.toLowerCase().includes(newContact.name.toLowerCase())).length === 0 && (
                   <div className="px-3 py-2 text-xs text-gray-400 italic">No existing contacts found</div>
                 )}
              </div>
            )}
          </div>
          <Input
            placeholder="Email"
            value={newContact.email}
            onChange={(e) => setNewContact((c) => ({ ...c, email: e.target.value }))}
            className="h-8 text-xs"
          />
          <Input
            placeholder="Phone"
            value={newContact.phone}
            onChange={(e) => setNewContact((c) => ({ ...c, phone: e.target.value }))}
            className="h-8 text-xs"
          />
          <Input
            placeholder="Role (e.g. Builder)"
            value={newContact.role}
            onChange={(e) => setNewContact((c) => ({ ...c, role: e.target.value }))}
            className="h-8 text-xs"
          />
        </div>
        <div className="flex items-center justify-end">
          <Button
            size="sm"
            onClick={() => createContactMutation.mutate()}
            disabled={!newContact.name || createContactMutation.isPending}
            className="h-8 bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            {createContactMutation.isPending ? "Adding…" : "Add contact"}
          </Button>
        </div>
      </div>
      </CollapsibleContent>
    </Collapsible>
  );
}