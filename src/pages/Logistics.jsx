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
  "At Supplier": "bg-indigo-50 text-indigo-600",
  "At Delivery Bay": "bg-blue-50 text-blue-600",
  "In Warehouse Storage": "bg-purple-50 text-purple-600",
  "With Technician": "bg-amber-50 text-amber-600",
  "At Client Site": "bg-green-50 text-green-600"
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
    const atDeliveryBay = activeParts.filter(p => p.location === "At Delivery Bay");
    
    return {
      totalActive: activeParts.length,
      overdue: urgentParts.length,
      readyForPickup: atDeliveryBay.length,
      withTech: activeParts.filter(p => p.location === "With Technician").length
    };
  }, [parts]);

  return (
    <div className="p-6 bg-[#ffffff] min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">Logistics Dashboard</h1>
            <p className="text-sm text-[#6B7280] mt-1">Manage parts, orders, and locations across all projects</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#6B7280]">Active Parts</p>
                <h3 className="text-2xl font-bold text-[#111827]">{stats.totalActive}</h3>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#6B7280]">Delivery Bay</p>
                <h3 className="text-2xl font-bold text-[#111827]">{stats.readyForPickup}</h3>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#6B7280]">With Technician</p>
                <h3 className="text-2xl font-bold text-[#111827]">{stats.withTech}</h3>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#6B7280]">Overdue ETA</p>
                <h3 className="text-2xl font-bold text-[#111827]">{stats.overdue}</h3>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
            <Input
              placeholder="Search by part, project, supplier, or order ref..."
              className="pl-9 border-[#E5E7EB] bg-[#F9FAFB]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[180px] bg-[#F9FAFB]">
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
            <SelectTrigger className="w-full md:w-[180px] bg-[#F9FAFB]">
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

        {/* Parts Table */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">Part Details</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">Project & Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">Dates</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">Logistics</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {partsLoading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-10 text-center text-[#6B7280]">
                      Loading parts data...
                    </td>
                  </tr>
                ) : filteredParts.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-10 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-12 h-12 bg-[#F3F4F6] rounded-full flex items-center justify-center mb-3">
                          <Search className="w-6 h-6 text-[#9CA3AF]" />
                        </div>
                        <p className="text-[#111827] font-medium">No parts found</p>
                        <p className="text-[#6B7280] text-sm mt-1">Try adjusting your search or filters</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredParts.map((part) => {
                    const project = projectMap[part.project_id];
                    const linkedJobs = (part.linked_logistics_jobs || []).map(id => jobMap[id]).filter(Boolean);
                    
                    return (
                      <tr key={part.id} className="hover:bg-[#F9FAFB] transition-colors group">
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => setSelectedPart(part)}
                            className="text-left group-hover:text-blue-600 transition-colors w-full"
                          >
                            <div className="font-medium text-[#111827] text-[15px]">{part.category}</div>
                            <div className="text-sm text-[#6B7280] mt-0.5">{part.supplier_name || "No Supplier"}</div>
                            {part.order_reference && (
                                <div className="text-xs text-[#9CA3AF] mt-0.5">Ref: {part.order_reference}</div>
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          {project ? (
                            <Link 
                              to={`${createPageUrl("Projects")}?projectId=${project.id}`}
                              className="block hover:underline"
                            >
                              <div className="text-sm font-medium text-[#111827] truncate max-w-[200px]">
                                {project.title}
                              </div>
                              <div className="text-sm text-[#6B7280]">{project.customer_name}</div>
                            </Link>
                          ) : (
                            <span className="text-sm text-[#9CA3AF] italic">Unassigned Project</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm space-y-1">
                            {part.order_date && (
                              <div className="text-[#6B7280]">
                                Ord: <span className="text-[#111827]">{format(new Date(part.order_date), 'MMM d')}</span>
                              </div>
                            )}
                            {part.eta && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[#6B7280]">ETA:</span>
                                <span className={`font-medium ${
                                  new Date(part.eta) < new Date() && part.status !== 'Delivered' 
                                    ? 'text-red-600' 
                                    : 'text-[#111827]'
                                }`}>
                                  {format(new Date(part.eta), 'MMM d')}
                                </span>
                                {new Date(part.eta) < new Date() && part.status !== 'Delivered' && (
                                  <AlertCircle className="w-3 h-3 text-red-500" />
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Select 
                            value={part.status} 
                            onValueChange={(val) => handleStatusChange(part.id, val)}
                          >
                            <SelectTrigger className={`h-8 w-[140px] text-xs font-medium border-0 ${STATUS_COLORS[part.status] || 'bg-gray-100'}`}>
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
                        <td className="px-6 py-4">
                          <Select 
                            value={part.location} 
                            onValueChange={(val) => handleLocationChange(part.id, val)}
                          >
                            <SelectTrigger className={`h-8 w-[160px] text-xs border-0 ${LOCATION_COLORS[part.location] || 'bg-gray-50'}`}>
                              <div className="flex items-center gap-2 truncate">
                                <MapPin className="w-3 h-3 opacity-50 flex-shrink-0" />
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
                        <td className="px-6 py-4">
                          {linkedJobs.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {linkedJobs.map(job => (
                                <Link 
                                  key={job.id}
                                  to={`${createPageUrl("Jobs")}?jobId=${job.id}`}
                                  className="inline-flex items-center gap-1.5 text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 px-2 py-1 rounded border border-slate-200 transition-colors w-fit"
                                >
                                  <LinkIcon className="w-3 h-3 text-slate-400" />
                                  #{job.job_number}
                                </Link>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-[#9CA3AF]">-</span>
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