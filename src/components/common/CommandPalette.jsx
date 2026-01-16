import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  Mail, 
  CheckSquare, 
  Calendar, 
  FolderKanban, 
  Briefcase, 
  UserCircle, 
  FileText,
  Building2,
  Package,
  Loader2
} from "lucide-react";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";

export default function CommandPalette({ open, onOpenChange }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [entityResults, setEntityResults] = useState({ jobs: [], projects: [], customers: [], organisations: [], priceListItems: [] });
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    const down = (e) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [onOpenChange]);

  // Search entities when query changes
  useEffect(() => {
    if (!query || query.length < 2) {
      setEntityResults({ jobs: [], projects: [], customers: [], organisations: [], priceListItems: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await base44.functions.invoke('globalSearch', { searchTerm: query });
        setEntityResults(response.data || { jobs: [], projects: [], customers: [], organisations: [], priceListItems: [] });
      } catch (err) {
        console.error("CommandPalette search error:", err);
        setEntityResults({ jobs: [], projects: [], customers: [], organisations: [], priceListItems: [] });
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const runCommand = React.useCallback((command) => {
    onOpenChange(false);
    setQuery("");
    setEntityResults({ jobs: [], projects: [], customers: [], organisations: [], priceListItems: [] });
    command();
  }, [onOpenChange]);

  if (!open) return null;

  const handleEntityNavigate = (entityType, item) => {
    let url = "";
    switch (entityType) {
      case "job":
        url = `${createPageUrl("Jobs")}?jobId=${item.id}`;
        break;
      case "project":
        url = `${createPageUrl("Projects")}?projectId=${item.id}`;
        break;
      case "customer":
        url = `${createPageUrl("Customers")}?customerId=${item.id}`;
        break;
      case "organisation":
        url = `${createPageUrl("Organisations")}?organisationId=${item.id}`;
        break;
      case "item":
        url = `${createPageUrl("PriceList")}?itemId=${item.id}`;
        break;
    }
    if (url) {
      runCommand(() => navigate(url));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center sm:items-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
        onClick={() => onOpenChange(false)}
      />
      
      {/* Command Dialog Container */}
      <div className="relative z-50 w-full max-w-lg overflow-hidden rounded-xl border bg-white shadow-2xl transition-all sm:mt-0 mt-16 mx-4">
        <Command className="rounded-xl border-none">
          <CommandInput placeholder="Search pages or entities..." value={query} onValueChange={setQuery} />
          <CommandList>
            {searchLoading && (
              <div className="flex items-center justify-center py-8 gap-2 text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Searching...</span>
              </div>
            )}
            {!searchLoading && query.length >= 2 && Object.values(entityResults).every(arr => arr.length === 0) && (
              <CommandEmpty>No results found.</CommandEmpty>
            )}
            {!query && !searchLoading && (
              <CommandEmpty>Search pages or entities...</CommandEmpty>
            )}

            {/* Entity Results */}
            {!searchLoading && query.length >= 2 && (
              <>
                {entityResults.jobs?.length > 0 && (
                  <CommandGroup heading="Jobs">
                    {entityResults.jobs.map((job) => (
                      <CommandItem
                        key={job.id}
                        value={`job-${job.id}`}
                        onSelect={() => handleEntityNavigate("job", job)}
                        onMouseDown={(e) => e.preventDefault()}
                        className="cursor-pointer"
                      >
                        <Briefcase className="mr-2 h-4 w-4 text-blue-600" />
                        <span>#{job.job_number} • {job.customer_name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {entityResults.projects?.length > 0 && (
                  <CommandGroup heading="Projects">
                    {entityResults.projects.map((project) => (
                      <CommandItem
                        key={project.id}
                        value={`project-${project.id}`}
                        onSelect={() => handleEntityNavigate("project", project)}
                        onMouseDown={(e) => e.preventDefault()}
                        className="cursor-pointer"
                      >
                        <FolderKanban className="mr-2 h-4 w-4 text-purple-600" />
                        <span>{project.title}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {entityResults.customers?.length > 0 && (
                  <CommandGroup heading="Customers">
                    {entityResults.customers.map((customer) => (
                      <CommandItem
                        key={customer.id}
                        value={`customer-${customer.id}`}
                        onSelect={() => handleEntityNavigate("customer", customer)}
                        onMouseDown={(e) => e.preventDefault()}
                        className="cursor-pointer"
                      >
                        <UserCircle className="mr-2 h-4 w-4 text-green-600" />
                        <span>{customer.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {entityResults.organisations?.length > 0 && (
                  <CommandGroup heading="Organisations">
                    {entityResults.organisations.map((org) => (
                      <CommandItem
                        key={org.id}
                        value={`org-${org.id}`}
                        onSelect={() => handleEntityNavigate("organisation", org)}
                        onMouseDown={(e) => e.preventDefault()}
                        className="cursor-pointer"
                      >
                        <Building2 className="mr-2 h-4 w-4 text-purple-600" />
                        <span>{org.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}

                {entityResults.priceListItems?.length > 0 && (
                  <CommandGroup heading="Inventory Items">
                    {entityResults.priceListItems.map((item) => (
                      <CommandItem
                        key={item.id}
                        value={`item-${item.id}`}
                        onSelect={() => handleEntityNavigate("item", item)}
                        onMouseDown={(e) => e.preventDefault()}
                        className="cursor-pointer"
                      >
                        <Package className="mr-2 h-4 w-4 text-orange-600" />
                        <span>{item.item}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            )}

            {/* Page Navigation */}
            {!query && (
              <>
                <CommandGroup heading="Pages">
                  <CommandItem
                    onSelect={(_value) => runCommand(() => navigate(createPageUrl("Dashboard")))}
                    className="cursor-pointer"
                  >
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    <span>Dashboard</span>
                  </CommandItem>
                  <CommandItem
                    onSelect={(_value) => runCommand(() => navigate(createPageUrl("Inbox")))}
                    className="cursor-pointer"
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    <span>Inbox</span>
                  </CommandItem>
                  <CommandItem
                    onSelect={(_value) => runCommand(() => navigate(createPageUrl("Tasks")))}
                    className="cursor-pointer"
                  >
                    <CheckSquare className="mr-2 h-4 w-4" />
                    <span>Tasks</span>
                  </CommandItem>
                  <CommandItem
                    onSelect={(_value) => runCommand(() => navigate(createPageUrl("Schedule")))}
                    className="cursor-pointer"
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    <span>Schedule</span>
                  </CommandItem>
                  <CommandItem
                    onSelect={(_value) => runCommand(() => navigate(createPageUrl("Projects")))}
                    className="cursor-pointer"
                  >
                    <FolderKanban className="mr-2 h-4 w-4" />
                    <span>Projects</span>
                  </CommandItem>
                  <CommandItem
                    onSelect={(_value) => runCommand(() => navigate(createPageUrl("Jobs")))}
                    className="cursor-pointer"
                  >
                    <Briefcase className="mr-2 h-4 w-4" />
                    <span>Jobs</span>
                  </CommandItem>
                  <CommandItem
                    onSelect={(_value) => runCommand(() => navigate(createPageUrl("Customers")))}
                    className="cursor-pointer"
                  >
                    <UserCircle className="mr-2 h-4 w-4" />
                    <span>Customers</span>
                  </CommandItem>
                  <CommandItem
                    onSelect={(_value) => runCommand(() => navigate(createPageUrl("Contracts")))}
                    className="cursor-pointer"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    <span>Contracts</span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </div>
    </div>
  );
}