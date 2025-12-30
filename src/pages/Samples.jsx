import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import CreateSampleModal from "@/components/samples/CreateSampleModal";
import SampleDetailModal from "@/components/samples/SampleDetailModal";
import SampleQuickActions from "@/components/samples/SampleQuickActions";
import { usePermissions } from "@/components/common/PermissionsContext";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Samples() {
  const navigate = useNavigate();
  const { canWrite } = usePermissions();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [checkedOutOnly, setCheckedOutOnly] = useState(false);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSample, setSelectedSample] = useState(null);

  const { data: samples = [], isLoading } = useQuery({
    queryKey: ['samples'],
    queryFn: () => base44.entities.Sample.list(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const filteredSamples = useMemo(() => {
    let result = samples;

    // Search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(s => 
        s.name?.toLowerCase().includes(searchLower) ||
        s.sample_tag?.toLowerCase().includes(searchLower) ||
        s.category?.toLowerCase().includes(searchLower)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter(s => s.status === statusFilter);
    }

    // Location filter
    if (locationFilter !== "all") {
      result = result.filter(s => s.current_location_type === locationFilter);
    }

    // Checked out only
    if (checkedOutOnly) {
      result = result.filter(s => s.checked_out_project_id);
    }

    // Overdue only
    if (overdueOnly) {
      const today = new Date().toISOString().split('T')[0];
      result = result.filter(s => 
        s.checked_out_project_id && 
        s.due_back_at && 
        s.due_back_at < today
      );
    }

    return result;
  }, [samples, search, statusFilter, locationFilter, checkedOutOnly, overdueOnly]);

  const getLocationDisplay = (sample) => {
    const type = sample.current_location_type;
    const refId = sample.current_location_reference_id;

    if (type === 'warehouse') return { label: 'Warehouse', color: 'bg-slate-100 text-slate-700' };
    if (type === 'unknown') return { label: 'Unknown', color: 'bg-gray-100 text-gray-700' };
    if (type === 'vehicle') {
      const vehicle = vehicles.find(v => v.id === refId);
      return { 
        label: vehicle ? `Vehicle: ${vehicle.name}` : 'Vehicle', 
        color: 'bg-blue-100 text-blue-700' 
      };
    }
    if (type === 'project') {
      const project = projects.find(p => p.id === refId);
      return { 
        label: project ? `Project: ${project.title}` : 'At Project', 
        color: 'bg-purple-100 text-purple-700' 
      };
    }
    return { label: type, color: 'bg-gray-100 text-gray-700' };
  };

  const getStatusBadge = (status) => {
    if (status === 'active') return 'bg-green-100 text-green-700';
    if (status === 'lost') return 'bg-red-100 text-red-700';
    if (status === 'retired') return 'bg-gray-100 text-gray-700';
    return 'bg-gray-100 text-gray-700';
  };

  const isOverdue = (sample) => {
    if (!sample.checked_out_project_id || !sample.due_back_at) return false;
    const today = new Date().toISOString().split('T')[0];
    return sample.due_back_at < today;
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[28px] font-bold text-[#111827]">Samples</h1>
        {canWrite && (
          <Button onClick={() => setShowCreateModal(true)} className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]">
            <Plus className="w-4 h-4 mr-2" />
            New Sample
          </Button>
        )}
      </div>

      <Card className="border border-[#E5E7EB] rounded-xl p-4 mb-6">
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
            <Input
              placeholder="Search by name, tag, or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium text-[#6B7280]">Status:</span>
              <div className="flex gap-1">
                {['all', 'active', 'lost', 'retired'].map(status => (
                  <Button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    variant={statusFilter === status ? 'default' : 'outline'}
                    size="sm"
                    className={statusFilter === status ? 'bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]' : ''}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium text-[#6B7280]">Location:</span>
              <div className="flex gap-1">
                {['all', 'warehouse', 'vehicle', 'project', 'unknown'].map(loc => (
                  <Button
                    key={loc}
                    onClick={() => setLocationFilter(loc)}
                    variant={locationFilter === loc ? 'default' : 'outline'}
                    size="sm"
                    className={locationFilter === loc ? 'bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]' : ''}
                  >
                    {loc.charAt(0).toUpperCase() + loc.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checkedOutOnly}
                  onChange={(e) => setCheckedOutOnly(e.target.checked)}
                  className="w-4 h-4 rounded border-[#E5E7EB]"
                />
                <span className="text-[13px] font-medium text-[#6B7280]">Checked Out Only</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={overdueOnly}
                  onChange={(e) => setOverdueOnly(e.target.checked)}
                  className="w-4 h-4 rounded border-[#E5E7EB]"
                />
                <span className="text-[13px] font-medium text-[#6B7280]">Overdue Only</span>
              </label>
            </div>
          </div>
        </div>
      </Card>

      {/* Results count */}
      <div className="mb-4 text-[13px] text-[#6B7280]">
        Showing {filteredSamples.length} of {samples.length} samples
      </div>

      {/* Table */}
      <Card className="border border-[#E5E7EB] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
              <tr>
                <th className="px-4 py-3 text-left text-[13px] font-semibold text-[#111827]">Sample Tag</th>
                <th className="px-4 py-3 text-left text-[13px] font-semibold text-[#111827]">Name</th>
                <th className="px-4 py-3 text-left text-[13px] font-semibold text-[#111827]">Category</th>
                <th className="px-4 py-3 text-left text-[13px] font-semibold text-[#111827]">Status</th>
                <th className="px-4 py-3 text-left text-[13px] font-semibold text-[#111827]">Current Location</th>
                <th className="px-4 py-3 text-left text-[13px] font-semibold text-[#111827]">With Project</th>
                <th className="px-4 py-3 text-left text-[13px] font-semibold text-[#111827]">Due Back</th>
                <th className="px-4 py-3 text-left text-[13px] font-semibold text-[#111827]">Last Seen</th>
                <th className="px-4 py-3 text-left text-[13px] font-semibold text-[#111827]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-[#6B7280]">
                    Loading samples...
                  </td>
                </tr>
              ) : filteredSamples.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-[#6B7280]">
                    No samples found
                  </td>
                </tr>
              ) : (
                filteredSamples.map(sample => {
                  const location = getLocationDisplay(sample);
                  const project = sample.checked_out_project_id ? projects.find(p => p.id === sample.checked_out_project_id) : null;
                  const overdue = isOverdue(sample);

                  return (
                    <tr 
                      key={sample.id} 
                      onClick={() => setSelectedSample(sample)}
                      className="border-b border-[#E5E7EB] hover:bg-[#F9FAFB] cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-[14px] font-medium text-[#111827]">
                        {sample.sample_tag || '-'}
                      </td>
                      <td className="px-4 py-3 text-[14px] text-[#111827]">{sample.name}</td>
                      <td className="px-4 py-3 text-[14px] text-[#6B7280]">{sample.category || '-'}</td>
                      <td className="px-4 py-3">
                        <Badge className={getStatusBadge(sample.status)}>
                          {sample.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={location.color}>
                          {location.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {project ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`${createPageUrl('Projects')}?projectId=${project.id}`);
                            }}
                            className="text-[#2563EB] hover:underline text-[14px]"
                          >
                            {project.title}
                          </button>
                        ) : (
                          <span className="text-[#6B7280] text-[14px]">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {sample.due_back_at ? (
                          <span className={`text-[14px] ${overdue ? 'text-red-600 font-semibold' : 'text-[#111827]'}`}>
                            {new Date(sample.due_back_at).toLocaleDateString()}
                            {overdue && <span className="ml-1 text-[11px]">(OVERDUE)</span>}
                          </span>
                        ) : (
                          <span className="text-[#6B7280] text-[14px]">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[14px] text-[#6B7280]">
                        {sample.last_seen_at ? new Date(sample.last_seen_at).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {sample.status === 'active' && (
                          <SampleQuickActions sample={sample} />
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {showCreateModal && (
        <CreateSampleModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {selectedSample && (
        <SampleDetailModal
          sample={selectedSample}
          onClose={() => setSelectedSample(null)}
        />
      )}
    </div>
  );
}