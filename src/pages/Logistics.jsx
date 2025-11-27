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

        {/* Parts List */}
        <div className="space-y-3">
          {partsLoading ? (
            <div className="text-center py-10 text-[#6B7280]">Loading parts data...</div>
          ) : filteredParts.length === 0 ? (
             <Card className="border border-[#E5E7EB] shadow-sm">
               <CardContent className="p-10 text-center">
                 <div className="flex flex-col items-center justify-center">
                   <div className="w-12 h-12 bg-[#F3F4F6] rounded-full flex items-center justify-center mb-3">
                     <Search className="w-6 h-6 text-[#9CA3AF]" />
                   </div>
                   <p className="text-[#111827] font-medium">No parts found</p>
                   <p className="text-[#6B7280] text-sm mt-1">Try adjusting your search or filters</p>
                 </div>
               </CardContent>
             </Card>
          ) : (
            filteredParts.map((part) => {
              const project = projectMap[part.project_id];
              const linkedJobs = (part.linked_logistics_jobs || []).map(id => jobMap[id]).filter(Boolean);
              
              return (
                <Card 
                  key={part.id}
                  className="border border-[#E5E7EB] hover:border-[#FAE008] hover:shadow-md transition-all group"
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                      {/* Main Info */}
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedPart(part)}>
                        <div className="flex items-start justify-between md:hidden mb-2">
                           <div className="font-semibold text-[#111827] text-[15px]">{part.category}</div>
                           {part.order_reference && (
                             <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                               {part.order_reference}
                             </span>
                           )}
                        </div>
                        
                        <div className="hidden md:flex items-center gap-2 mb-1">
                          <span className="font-semibold text-[#111827] text-[15px] group-hover:text-blue-600 transition-colors">
                            {part.category}
                          </span>
                          {part.order_reference && (
                            <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600 border border-slate-200">
                              {part.order_reference}
                            </span>
                          )}
                        </div>

                        <div className="text-sm text-[#4B5563] mb-2">
                          {part.supplier_name || "No Supplier"}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#6B7280]">
                           {project ? (
                             <Link 
                               to={`${createPageUrl("Projects")}?projectId=${project.id}`}
                               onClick={(e) => e.stopPropagation()}
                               className="flex items-center gap-1.5 hover:text-blue-600 transition-colors"
                             >
                               <Package className="w-3.5 h-3.5" />
                               <span className="font-medium truncate max-w-[150px]">{project.title}</span>
                             </Link>
                           ) : (
                             <span className="flex items-center gap-1.5 italic">
                               <Package className="w-3.5 h-3.5" />
                               Unassigned Project
                             </span>
                           )}

                           {(part.eta || part.order_date) && (
                             <div className="flex items-center gap-1.5">
                               <Clock className="w-3.5 h-3.5" />
                               <span>
                                 {part.eta ? (
                                   <>ETA: <span className={new Date(part.eta) < new Date() && part.status !== 'Delivered' ? "text-red-600 font-medium" : "font-medium text-[#111827]"}>{format(new Date(part.eta), 'MMM d')}</span></>
                                 ) : (
                                   <>Ord: <span className="font-medium text-[#111827]">{format(new Date(part.order_date), 'MMM d')}</span></>
                                 )}
                               </span>
                             </div>
                           )}
                        </div>
                      </div>

                      {/* Controls */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 md:border-l md:border-[#E5E7EB] md:pl-4 md:w-[40%]">
                        <div className="w-full space-y-2">
                          <div className="flex items-center justify-between sm:justify-start gap-2">
                            <span className="text-xs font-medium text-[#6B7280] w-16 md:hidden">Status:</span>
                            <Select 
                              value={part.status} 
                              onValueChange={(val) => handleStatusChange(part.id, val)}
                            >
                              <SelectTrigger className={`h-8 flex-1 text-xs font-medium border-0 ${STATUS_COLORS[part.status] || 'bg-gray-100'}`}>
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
                          </div>

                          <div className="flex items-center justify-between sm:justify-start gap-2">
                            <span className="text-xs font-medium text-[#6B7280] w-16 md:hidden">Location:</span>
                            <Select 
                              value={part.location} 
                              onValueChange={(val) => handleLocationChange(part.id, val)}
                            >
                              <SelectTrigger className={`h-8 flex-1 text-xs border-0 ${LOCATION_COLORS[part.location] || 'bg-gray-50'}`}>
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
                          </div>
                        </div>
                        
                        {/* Linked Jobs */}
                        {linkedJobs.length > 0 && (
                           <div className="flex flex-wrap gap-1.5 w-full">
                             {linkedJobs.map(job => (
                               <Link 
                                 key={job.id}
                                 to={`${createPageUrl("Jobs")}?jobId=${job.id}`}
                                 onClick={(e) => e.stopPropagation()}
                                 className="inline-flex items-center gap-1 text-[10px] bg-slate-50 hover:bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 transition-colors"
                               >
                                 <LinkIcon className="w-2.5 h-2.5 text-slate-400" />
                                 #{job.job_number}
                               </Link>
                             ))}
                           </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
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