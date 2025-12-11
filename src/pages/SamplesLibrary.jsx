import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useDebounce } from "@/components/common/useDebounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreVertical, History, Home, AlertTriangle, Archive } from "lucide-react";
import { format } from "date-fns";
import {
  getSampleStatusColor,
  getSampleLocationLabel,
  SAMPLE_STATUS,
  SAMPLE_LOCATION_TYPE,
} from "../components/domain/sampleConfig";
import CreateSampleModal from "../components/samples/CreateSampleModal";
import SampleMovementHistoryModal from "../components/samples/SampleMovementHistoryModal";
import ReassignHomeModal from "../components/samples/ReassignHomeModal";
import BackButton from "../components/common/BackButton";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

export default function SamplesLibrary() {
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 250);
  const [statusFilter, setStatusFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [historyModal, setHistoryModal] = useState(null);
  const [reassignModal, setReassignModal] = useState(null);
  const queryClient = useQueryClient();

  const { data: samples = [], isLoading } = useQuery({
    queryKey: ['samples'],
    queryFn: () => base44.entities.Sample.list('-created_date'),
  });

  const { data: movements = [] } = useQuery({
    queryKey: ['sampleMovements'],
    queryFn: () => base44.entities.SampleMovement.list('-created_date', 500),
  });

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set();
    samples.forEach(s => s.category && cats.add(s.category));
    return Array.from(cats).sort();
  }, [samples]);

  // Get last movement date for each sample
  const lastMovementMap = useMemo(() => {
    const map = {};
    movements.forEach(m => {
      if (!map[m.sample_id] || new Date(m.created_date) > new Date(map[m.sample_id])) {
        map[m.sample_id] = m.created_date;
      }
    });
    return map;
  }, [movements]);

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Sample.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['samples'] });
      toast.success("Sample status updated");
    },
    onError: (error) => {
      toast.error(`Failed to update status: ${error.message}`);
    },
  });

  const filteredSamples = useMemo(() => {
    return samples.filter(sample => {
      const matchesSearch = !debouncedSearchTerm || 
        sample.name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        sample.sample_tag?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        sample.category?.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || sample.status === statusFilter;
      const matchesLocation = locationFilter === "all" || sample.location_type === locationFilter;
      const matchesCategory = categoryFilter === "all" || sample.category === categoryFilter;
      
      return matchesSearch && matchesStatus && matchesLocation && matchesCategory;
    });
  }, [samples, debouncedSearchTerm, statusFilter, locationFilter, categoryFilter]);

  return (
    <div className="p-4 md:p-5 lg:p-10 bg-[#ffffff] min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <BackButton to={createPageUrl("Dashboard")} />
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">Samples Library</h1>
            <p className="text-sm text-[#4B5563] mt-1">
              Manage and track physical samples
            </p>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Sample
          </Button>
        </div>

        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                <Input
                  placeholder="Search samples..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value={SAMPLE_STATUS.ACTIVE}>Active</SelectItem>
                  <SelectItem value={SAMPLE_STATUS.MISSING}>Missing</SelectItem>
                  <SelectItem value={SAMPLE_STATUS.RETIRED}>Retired</SelectItem>
                </SelectContent>
              </Select>
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  <SelectItem value={SAMPLE_LOCATION_TYPE.WAREHOUSE}>Warehouse</SelectItem>
                  <SelectItem value={SAMPLE_LOCATION_TYPE.VEHICLE}>Vehicle</SelectItem>
                  <SelectItem value={SAMPLE_LOCATION_TYPE.WITH_CLIENT}>With Client</SelectItem>
                  <SelectItem value={SAMPLE_LOCATION_TYPE.IN_TRANSIT_DROP_OFF}>In Transit (Drop-Off)</SelectItem>
                  <SelectItem value={SAMPLE_LOCATION_TYPE.IN_TRANSIT_PICKUP}>In Transit (Pickup)</SelectItem>
                  <SelectItem value={SAMPLE_LOCATION_TYPE.LOST}>Lost</SelectItem>
                </SelectContent>
              </Select>
              {categories.length > 0 && (
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>
                Samples
                {filteredSamples.length > 0 && (
                  <Badge variant="outline" className="ml-2">
                    {filteredSamples.length}
                  </Badge>
                )}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-center py-12 text-[#6B7280]">Loading samples...</div>
            ) : filteredSamples.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[#6B7280]">No samples found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                    <tr>
                      <th className="text-left p-3 font-medium text-[#6B7280]">Sample Name</th>
                      <th className="text-left p-3 font-medium text-[#6B7280]">Category</th>
                      <th className="text-left p-3 font-medium text-[#6B7280]">Current Location</th>
                      <th className="text-left p-3 font-medium text-[#6B7280]">Status</th>
                      <th className="text-left p-3 font-medium text-[#6B7280]">Home Location</th>
                      <th className="text-left p-3 font-medium text-[#6B7280]">Last Movement</th>
                      <th className="text-right p-3 font-medium text-[#6B7280]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {filteredSamples.map((sample) => {
                      const lastMovement = lastMovementMap[sample.id];
                      
                      return (
                        <tr key={sample.id} className="hover:bg-[#F9FAFB]">
                          <td className="p-3">
                            <div className="font-medium text-[#111827]">{sample.name}</div>
                            {sample.sample_tag && (
                              <div className="text-[11px] text-[#6B7280] font-mono">
                                {sample.sample_tag}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-[#4B5563]">
                            {sample.category || "-"}
                          </td>
                          <td className="p-3">
                            <span className="text-[#111827]">
                              {getSampleLocationLabel(sample.location_type)}
                            </span>
                          </td>
                          <td className="p-3">
                            <Badge
                              variant="outline"
                              className={getSampleStatusColor(sample.status)}
                            >
                              {sample.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-[#4B5563]">
                            {sample.home_location_type 
                              ? getSampleLocationLabel(sample.home_location_type)
                              : "-"
                            }
                          </td>
                          <td className="p-3 text-[#4B5563]">
                            {lastMovement 
                              ? format(new Date(lastMovement), "MMM d, yyyy")
                              : "-"
                            }
                          </td>
                          <td className="p-3 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => setHistoryModal(sample)}
                                  className="gap-2"
                                >
                                  <History className="w-4 h-4" />
                                  View Movement History
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setReassignModal(sample)}
                                  className="gap-2"
                                >
                                  <Home className="w-4 h-4" />
                                  Reassign Home
                                </DropdownMenuItem>
                                {sample.status === SAMPLE_STATUS.ACTIVE && (
                                  <DropdownMenuItem
                                    onClick={() => updateStatusMutation.mutate({
                                      id: sample.id,
                                      status: SAMPLE_STATUS.MISSING
                                    })}
                                    className="gap-2 text-amber-600"
                                  >
                                    <AlertTriangle className="w-4 h-4" />
                                    Mark as Missing
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => updateStatusMutation.mutate({
                                    id: sample.id,
                                    status: SAMPLE_STATUS.RETIRED
                                  })}
                                  className="gap-2 text-[#6B7280]"
                                >
                                  <Archive className="w-4 h-4" />
                                  Retire Sample
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <CreateSampleModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
        />

        <SampleMovementHistoryModal
          open={!!historyModal}
          onClose={() => setHistoryModal(null)}
          sample={historyModal}
        />

        <ReassignHomeModal
          open={!!reassignModal}
          onClose={() => setReassignModal(null)}
          sample={reassignModal}
        />
      </div>
    </div>
  );
}