import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { searchAll } from "@/components/api/globalSearch";
import { createPageUrl } from "@/utils";
import { Briefcase, FolderKanban, User, Loader2 } from "lucide-react";

export default function GlobalSearchPalette({ open, onOpenChange }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ jobs: [], projects: [], customers: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults({ jobs: [], projects: [], customers: [] });
    }
  }, [open]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!query || query.length < 2) {
        setResults({ jobs: [], projects: [], customers: [] });
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const data = await searchAll(query);
        setResults(data);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (type, item) => {
    let url = "";
    switch (type) {
      case "job":
        url = `${createPageUrl("Jobs")}?jobId=${item.id}`;
        break;
      case "project":
        url = `${createPageUrl("Projects")}?projectId=${item.id}`;
        break;
      case "customer":
        url = `${createPageUrl("Customers")}?customerId=${item.id}`;
        break;
    }
    if (url) {
      navigate(url);
      onOpenChange(false);
    }
  };

  // Handle closing when clicking backdrop
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onOpenChange(false);
    }
  };

  // Handle Escape key
  useEffect(() => {
    const down = (e) => {
      if (e.key === "Escape" && open) {
        e.preventDefault();
        onOpenChange(false);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh] backdrop-blur-sm transition-all p-4"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        <Command className="rounded-xl border-none h-full bg-white" shouldFilter={false}>
          <div className="flex items-center border-b border-slate-100 px-3">
            <CommandInput
              placeholder="Search jobs, projects, customers..."
              value={query}
              onValueChange={setQuery}
              className="text-base h-14 border-none focus:ring-0"
              autoFocus
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400 mr-2" />}
          </div>
          <CommandList className="max-h-[60vh] overflow-y-auto py-2">
            <CommandEmpty className="py-6 text-center text-sm text-slate-500">
              {query.length < 2 ? "Type at least 2 characters to search..." : "No results found."}
            </CommandEmpty>

            {results.jobs.length > 0 && (
              <CommandGroup heading="Jobs" className="px-2 text-slate-500">
                {results.jobs.map((job) => (
                  <CommandItem
                    key={job.id}
                    value={`job-${job.id}-${job.job_number}`}
                    onSelect={() => handleSelect("job", job)}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer hover:bg-slate-50 aria-selected:bg-slate-100 my-1"
                  >
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                      <Briefcase className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="font-medium text-slate-900 truncate">
                        #{job.job_number} • {job.customer_name}
                      </span>
                      <span className="text-xs text-slate-500 truncate">
                        {job.address || "No address"}
                      </span>
                    </div>
                    {job.status && (
                      <span className="text-xs bg-slate-100 px-2 py-1 rounded-full text-slate-600 hidden sm:inline-block whitespace-nowrap">
                        {job.status}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {results.projects.length > 0 && (
              <CommandGroup heading="Projects" className="px-2 text-slate-500">
                {results.projects.map((project) => (
                  <CommandItem
                    key={project.id}
                    value={`project-${project.id}-${project.title}`}
                    onSelect={() => handleSelect("project", project)}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer hover:bg-slate-50 aria-selected:bg-slate-100 my-1"
                  >
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-purple-50 text-purple-600">
                      <FolderKanban className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="font-medium text-slate-900 truncate">{project.title}</span>
                      <span className="text-xs text-slate-500 truncate">
                        {project.customer_name || "No customer"}
                      </span>
                    </div>
                    {project.status && (
                      <span className="text-xs bg-slate-100 px-2 py-1 rounded-full text-slate-600 hidden sm:inline-block whitespace-nowrap">
                        {project.status}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {results.customers.length > 0 && (
              <CommandGroup heading="Customers" className="px-2 text-slate-500">
                {results.customers.map((customer) => (
                  <CommandItem
                    key={customer.id}
                    value={`customer-${customer.id}-${customer.name}`}
                    onSelect={() => handleSelect("customer", customer)}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer hover:bg-slate-50 aria-selected:bg-slate-100 my-1"
                  >
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-green-50 text-green-600">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="font-medium text-slate-900 truncate">{customer.name}</span>
                      <span className="text-xs text-slate-500 truncate">
                        {customer.email || customer.phone || "No contact info"}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </div>
    </div>
  );
}