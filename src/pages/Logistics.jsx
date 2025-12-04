import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Truck, Package, MapPin, CheckCircle2, Clock, AlertCircle, Link as LinkIcon } from "lucide-react";
import { format } from "date-fns";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import PartDetailModal from "../components/projects/PartDetailModal";
import { toast } from "sonner";
import { INVENTORY_LOCATION } from "@/components/domain/inventoryLocationConfig";

const STATUS_COLORS = {
  "Pending": "bg-slate-100 text-slate-800 border-slate-200",
  "Ordered": "bg-blue-100 text-blue-800 border-blue-200",
  "Back-ordered": "bg-amber-100 text-amber-800 border-amber-200",
  "Delivered": "bg-green-100 text-green-800 border-green-200",
  "Returned": "bg-orange-100 text-orange-800 border-orange-200",
  "Cancelled": "bg-red-100 text-red-800 border-red-200"
};

const LOCATION_COLORS = {
  "On Order": "bg-slate-50 text-slate-600",
  [INVENTORY_LOCATION.SUPPLIER]: "bg-indigo-50 text-indigo-600",
  [INVENTORY_LOCATION.DELIVERY_BAY]: "bg-blue-50 text-blue-600",
  [INVENTORY_LOCATION.WAREHOUSE]: "bg-purple-50 text-purple-600",
  [INVENTORY_LOCATION.WITH_TECHNICIAN]: "bg-amber-50 text-amber-600",
  [INVENTORY_LOCATION.AT_CLIENT_SITE]: "bg-green-50 text-green-600"
};

export default function Logistics() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("active"); // active, all, specific statuses
  const [locationFilter, setLocationFilter] = useState("all");
  const [selectedPart, setSelectedPart] = useState(null);

  // Fetch Data
  const { data: parts = [], isLoading: partsLoading } = useQuery({
    queryKey: ['parts'],
    queryFn: () => base44.entities.Part.list(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list(),
  });

  // Maps for quick lookup
  const projectMap = useMemo(() => {
    return projects.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
  }, [projects]);

  const jobMap = useMemo(() => {
    return jobs.reduce((acc, j) => ({ ...acc, [j.id]: j }), {});
  }, [jobs]);

  // Update Mutation
  const updatePartMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Part.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts'] });
      toast.success("Part updated successfully");
    },
    onError: () => toast.error("Failed to update part")
  });

  const handleStatusChange = (partId, newStatus) => {
    updatePartMutation.mutate({ id: partId, data: { status: newStatus } });
  };

  const handleLocationChange = (partId, newLocation) => {
    updatePartMutation.mutate({ id: partId, data: { location: newLocation } });
  };

  // Filtering
  const filteredParts = useMemo(() => {
    return parts.filter(part => {
      // Search
      const searchLower = searchTerm.toLowerCase();
      const project = projectMap[part.project_id];
      const matchesSearch = 
        part.category?.toLowerCase().includes(searchLower) ||
        part.supplier_name?.toLowerCase().includes(searchLower) ||
        part.order_reference?.toLowerCase().includes(searchLower) ||
        project?.title?.toLowerCase().includes(searchLower) ||
        project?.customer_name?.toLowerCase().includes(searchLower);

      if (!matchesSearch) return false;

      // Status Filter
      if (statusFilter === "active") {
        if (["Delivered", "Cancelled", "Returned"].includes(part.status)) return false;
      } else if (statusFilter !== "all") {
        if (part.status !== statusFilter) return false;
      }

      // Location Filter
      if (locationFilter !== "all" && part.location !== locationFilter) return false;

      return true;
    }).sort((a, b) => {
        // Sort by date desc (newest first)
        const dateA = a.order_date || a.created_date;
        const dateB = b.order_date || b.created_date;
        return new Date(dateB) - new Date(dateA);
    });
  }, [parts, searchTerm, statusFilter, locationFilter, projectMap]);

  // Stats
  const stats = useMemo(() => {
    const activeParts = parts.filter(p => !["Delivered", "Cancelled", "Returned"].includes(p.status));
    const urgentParts = activeParts.filter(p => {
        if (!p.eta) return false;
        return new Date(p.eta) < new Date(); // Overdue
    });
    const atDeliveryBay = activeParts.filter(p => p.location === INVENTORY_LOCATION.DELIVERY_BAY);
    
    return {
      totalActive: activeParts.length,
      overdue: urgentParts.length,
      readyForPickup: atDeliveryBay.length,
      withTech: activeParts.filter(p => p.location === INVENTORY_LOCATION.WITH_TECHNICIAN).length
    };
  }, [parts]);

  return (
    <div className="p-4 md:p-5 lg:p-10 bg-[#ffffff] min-h-screen">
      <div className="max-w-7xl mx-auto w-full space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">Logistics Dashboard</h1>
            <p className="text-sm text-[#6B7280] mt-1">Manage parts, orders, and locations across all projects</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border border-[#E5E7EB] shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#6B7280]">Active Parts</p>
                <h3 className="text-2xl font-bold text-[#111827]">{stats.totalActive}</h3>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border border-[#E5E7EB] shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#6B7280]">Delivery Bay</p>
                <h3 className="text-2xl font-bold text-[#111827]">{stats.readyForPickup}</h3>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-[#E5E7EB] shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#6B7280]">With Technician</p>
                <h3 className="text-2xl font-bold text-[#111827]">{stats.withTech}</h3>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-[#E5E7EB] shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#6B7280]">Overdue ETA</p>
                <h3 className="text-2xl font-bold text-[#111827]">{stats.overdue}</h3>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
            <Input
              placeholder="Search by part, project, supplier, or order ref..."
              className="pl-9 pr-3 border border-[#E5E7EB] focus:border-[#111827] focus:ring-1 focus:ring-[#111827] transition-all h-10 text-sm rounded-lg w-full bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px] h-10 rounded-lg border border-[#E5E7EB] focus:border-[#111827] focus:ring-1 focus:ring-[#111827]">
                <SelectValue placeholder="Filter Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Ordered">Ordered</SelectItem>
                <SelectItem value="Back-ordered">Back-ordered</SelectItem>
                <SelectItem value="Delivered">Delivered</SelectItem>
              </SelectContent>
            </Select>

            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-full md:w-[180px] h-10 rounded-lg border border-[#E5E7EB] focus:border-[#111827] focus:ring-1 focus:ring-[#111827]">
                <SelectValue placeholder="Filter Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {Object.keys(LOCATION_COLORS).map(loc => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Parts Table */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 font-semibold text-gray-900">Part Details</th>
                  <th className="px-6 py-4 font-semibold text-gray-900">Project & Customer</th>
                  <th className="px-6 py-4 font-semibold text-gray-900">Dates</th>
                  <th className="px-6 py-4 font-semibold text-gray-900">Status</th>
                  <th className="px-6 py-4 font-semibold text-gray-900">Location</th>
                  <th className="px-6 py-4 font-semibold text-gray-900">Logistics</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {partsLoading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
                        <p>Loading parts data...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredParts.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                          <Search className="w-6 h-6 text-gray-400" />
                        </div>
                        <h3 className="text-gray-900 font-medium mb-1">No parts found</h3>
                        <p className="text-gray-500 text-sm">
                          No parts match your current search filters. Try adjusting your search terms or clearing filters.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredParts.map((part) => {
                    const project = projectMap[part.project_id];
                    const linkedJobs = (part.linked_logistics_jobs || []).map(id => jobMap[id]).filter(Boolean);
                    
                    return (
                      <tr key={part.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-6 py-4 align-top">
                          <button 
                            onClick={() => setSelectedPart(part)}
                            className="text-left w-full group/btn"
                          >
                            <div className="font-medium text-gray-900 group-hover/btn:text-blue-600 transition-colors text-base">
                              {part.category}
                            </div>
                            <div className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                              <span className="truncate max-w-[200px]">{part.supplier_name || "No Supplier"}</span>
                              {part.order_reference && (
                                <>
                                  <span className="text-gray-300">•</span>
                                  <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                                    {part.order_reference}
                                  </span>
                                </>
                              )}
                            </div>
                          </button>
                        </td>
                        <td className="px-6 py-4 align-top">
                          {project ? (
                            <Link 
                              to={`${createPageUrl("Projects")}?projectId=${project.id}`}
                              className="block group/link"
                            >
                              <div className="font-medium text-gray-900 group-hover/link:text-blue-600 transition-colors truncate max-w-[200px]">
                                {project.title}
                              </div>
                              <div className="text-sm text-gray-500 mt-0.5">
                                {project.customer_name}
                              </div>
                            </Link>
                          ) : (
                            <span className="text-sm text-gray-400 italic">Unassigned Project</span>
                          )}
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="flex flex-col gap-1.5">
                            {part.order_date && (
                              <div className="text-sm text-gray-600 flex justify-between gap-4">
                                <span className="text-gray-400 text-xs uppercase tracking-wide font-medium">Ordered</span>
                                <span className="font-medium">{format(new Date(part.order_date), 'MMM d')}</span>
                              </div>
                            )}
                            {part.eta && (
                              <div className="text-sm flex justify-between gap-4">
                                <span className="text-gray-400 text-xs uppercase tracking-wide font-medium">ETA</span>
                                <div className="flex items-center gap-1.5">
                                  <span className={`font-medium ${
                                    new Date(part.eta) < new Date() && part.status !== 'Delivered' 
                                      ? 'text-red-600' 
                                      : 'text-gray-900'
                                  }`}>
                                    {format(new Date(part.eta), 'MMM d')}
                                  </span>
                                  {new Date(part.eta) < new Date() && part.status !== 'Delivered' && (
                                    <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <Select 
                            value={part.status} 
                            onValueChange={(val) => handleStatusChange(part.id, val)}
                          >
                            <SelectTrigger className={`h-9 border-0 font-medium text-xs w-[140px] ${STATUS_COLORS[part.status] || 'bg-gray-100'} shadow-sm`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.keys(STATUS_COLORS).map(status => (
                                <SelectItem key={status} value={status}>
                                  {status}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <Select 
                            value={part.location} 
                            onValueChange={(val) => handleLocationChange(part.id, val)}
                          >
                            <SelectTrigger className={`h-9 border-0 text-xs w-[170px] ${LOCATION_COLORS[part.location] || 'bg-gray-50'} shadow-sm`}>
                              <div className="flex items-center gap-2 truncate">
                                <MapPin className="w-3.5 h-3.5 opacity-50 flex-shrink-0" />
                                <SelectValue />
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              {Object.keys(LOCATION_COLORS).map(loc => (
                                <SelectItem key={loc} value={loc}>
                                  {loc}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-6 py-4 align-top">
                          {linkedJobs.length > 0 ? (
                            <div className="flex flex-col gap-1.5">
                              {linkedJobs.map(job => (
                                <Link 
                                  key={job.id}
                                  to={`${createPageUrl("Jobs")}?jobId=${job.id}`}
                                  className="inline-flex items-center gap-2 text-xs bg-white hover:bg-gray-50 text-gray-700 px-2.5 py-1.5 rounded-md border border-gray-200 transition-all hover:border-blue-300 hover:text-blue-600 w-fit shadow-sm"
                                >
                                  <LinkIcon className="w-3 h-3 opacity-50" />
                                  <span className="font-medium">#{job.job_number}</span>
                                </Link>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 font-medium">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Part Detail Modal */}
      {selectedPart && (
        <PartDetailModal
          open={!!selectedPart}
          part={selectedPart}
          onClose={() => setSelectedPart(null)}
          onSave={(data) => {
            updatePartMutation.mutate({ id: selectedPart.id, data });
            setSelectedPart(null);
          }}
          isSubmitting={updatePartMutation.isPending}
        />
      )}
    </div>
  );
}