import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, Search, MoreVertical, Package, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import SampleDetailModal from "../components/samplesv2/SampleDetailModal";
import CreateSampleModal from "../components/samplesv2/CreateSampleModal";
import CheckoutSampleModal from "../components/samplesv2/CheckoutSampleModal";
import ReturnSampleModal from "../components/samplesv2/ReturnSampleModal";
import TransferSampleModal from "../components/samplesv2/TransferSampleModal";
import MarkFoundModal from "../components/samplesv2/MarkFoundModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const getStatusColor = (status) => {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-700';
    case 'lost': return 'bg-red-100 text-red-700';
    case 'retired': return 'bg-gray-100 text-gray-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

const getLocationColor = (locationType) => {
  switch (locationType) {
    case 'warehouse': return 'bg-blue-100 text-blue-700';
    case 'vehicle': return 'bg-purple-100 text-purple-700';
    case 'project': return 'bg-yellow-100 text-yellow-700';
    case 'unknown': return 'bg-gray-100 text-gray-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

const getLocationLabel = (locationType) => {
  switch (locationType) {
    case 'warehouse': return 'Warehouse';
    case 'vehicle': return 'Vehicle';
    case 'project': return 'Project';
    case 'unknown': return 'Unknown';
    default: return locationType;
  }
};

const safeFormatDate = (dateString, formatString) => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return format(date, formatString);
  } catch {
    return '-';
  }
};

export default function SamplesLibraryV2() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedSample, setSelectedSample] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [checkoutSample, setCheckoutSample] = useState(null);
  const [returnSample, setReturnSample] = useState(null);
  const [transferSample, setTransferSample] = useState(null);
  const [markFoundSample, setMarkFoundSample] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: samples = [], isLoading } = useQuery({
    queryKey: ['samples'],
    queryFn: () => base44.entities.Sample.list(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projectsForSamples'],
    queryFn: () => base44.entities.Project.list(),
  });

  const canCreate = user?.role === 'admin' || user?.role === 'manager';
  const canUpdate = user?.role === 'admin' || user?.role === 'manager' || user?.is_field_technician;

  const categories = useMemo(() => {
    const cats = [...new Set(samples.map(s => s.category).filter(Boolean))];
    return cats.sort();
  }, [samples]);

  const filteredSamples = useMemo(() => {
    return samples.filter(sample => {
      const searchMatch = !searchTerm || 
        sample.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sample.sample_tag?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const statusMatch = statusFilter === 'all' || sample.status === statusFilter;
      const locationMatch = locationFilter === 'all' || sample.current_location_type === locationFilter;
      const categoryMatch = categoryFilter === 'all' || sample.category === categoryFilter;

      return searchMatch && statusMatch && locationMatch && categoryMatch;
    });
  }, [samples, searchTerm, statusFilter, locationFilter, categoryFilter]);

  const actionMutation = useMutation({
    mutationFn: async ({ action, payload }) => {
      const result = await base44.functions.invoke('manageSample', { action, ...payload });
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['samples'] });
      toast.success('Action completed successfully');
      setConfirmAction(null);
    },
    onError: (error) => {
      toast.error(`Action failed: ${error.message}`);
    },
  });

  const handleMarkLost = (sample) => {
    setConfirmAction({
      type: 'markLost',
      sample,
      title: 'Mark Sample as Lost?',
      description: `Are you sure you want to mark "${sample.name}" as lost? You can mark it as found later if recovered.`,
      action: () => actionMutation.mutate({
        action: 'markLost',
        payload: { sample_id: sample.id }
      }),
    });
  };

  const handleRetire = (sample) => {
    setConfirmAction({
      type: 'retire',
      sample,
      title: 'Retire Sample?',
      description: `Are you sure you want to retire "${sample.name}"? This will clear all checkout information.`,
      action: () => actionMutation.mutate({
        action: 'retireSample',
        payload: { sample_id: sample.id }
      }),
    });
  };

  const getProjectName = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    return project?.title || projectId;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[28px] font-bold text-[#111827]">Samples Library V2</h1>
            <p className="text-[14px] text-[#6B7280] mt-1">Manage physical samples with checkout tracking</p>
          </div>
          {canCreate && (
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Sample
            </Button>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
            <Input
              placeholder="Search by name or tag..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
              <SelectItem value="retired">Retired</SelectItem>
            </SelectContent>
          </Select>
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              <SelectItem value="warehouse">Warehouse</SelectItem>
              <SelectItem value="vehicle">Vehicle</SelectItem>
              <SelectItem value="project">Project</SelectItem>
              <SelectItem value="unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-[#6B7280]">Loading samples...</p>
        </div>
      ) : filteredSamples.length === 0 ? (
        <div className="text-center py-12 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB]">
          <Package className="w-12 h-12 mx-auto text-[#D1D5DB] mb-3" />
          <p className="text-[#6B7280]">No samples found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                <tr>
                  <th className="text-left py-3 px-4 text-[13px] font-semibold text-[#6B7280]">Name</th>
                  <th className="text-left py-3 px-4 text-[13px] font-semibold text-[#6B7280]">Category</th>
                  <th className="text-left py-3 px-4 text-[13px] font-semibold text-[#6B7280]">Tag</th>
                  <th className="text-left py-3 px-4 text-[13px] font-semibold text-[#6B7280]">Status</th>
                  <th className="text-left py-3 px-4 text-[13px] font-semibold text-[#6B7280]">Location</th>
                  <th className="text-left py-3 px-4 text-[13px] font-semibold text-[#6B7280]">Checked Out</th>
                  <th className="text-left py-3 px-4 text-[13px] font-semibold text-[#6B7280]">Due Back</th>
                  <th className="text-left py-3 px-4 text-[13px] font-semibold text-[#6B7280]">Last Seen</th>
                  <th className="text-right py-3 px-4 text-[13px] font-semibold text-[#6B7280]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {filteredSamples.map((sample) => (
                  <tr 
                    key={sample.id}
                    className="hover:bg-[#F9FAFB] cursor-pointer transition-colors"
                    onClick={() => setSelectedSample(sample)}
                  >
                    <td className="py-3 px-4 text-[14px] font-medium text-[#111827]">{sample.name}</td>
                    <td className="py-3 px-4 text-[14px] text-[#6B7280]">{sample.category || '-'}</td>
                    <td className="py-3 px-4 text-[14px] text-[#6B7280]">{sample.sample_tag || '-'}</td>
                    <td className="py-3 px-4">
                      <Badge className={getStatusColor(sample.status)}>
                        {sample.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={getLocationColor(sample.current_location_type)}>
                        {getLocationLabel(sample.current_location_type)}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-[14px] text-[#6B7280]">
                      {sample.checked_out_project_id ? (
                        <span className="text-[#2563EB]">{getProjectName(sample.checked_out_project_id)}</span>
                      ) : '-'}
                    </td>
                    <td className="py-3 px-4 text-[14px] text-[#6B7280]">
                      {safeFormatDate(sample.due_back_at, 'MMM d, yyyy')}
                    </td>
                    <td className="py-3 px-4 text-[14px] text-[#6B7280]">
                      {safeFormatDate(sample.last_seen_at, 'MMM d, h:mm a')}
                    </td>
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      {canUpdate && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {sample.status === 'active' && !sample.checked_out_project_id && (
                              <DropdownMenuItem onClick={() => setCheckoutSample(sample)}>
                                Checkout to Project
                              </DropdownMenuItem>
                            )}
                            {sample.checked_out_project_id && (
                              <DropdownMenuItem onClick={() => setReturnSample(sample)}>
                                Return Sample
                              </DropdownMenuItem>
                            )}
                            {sample.status === 'active' && !sample.checked_out_project_id && (
                              <DropdownMenuItem onClick={() => setTransferSample(sample)}>
                                Transfer to Vehicle
                              </DropdownMenuItem>
                            )}
                            {sample.status === 'active' && (
                              <DropdownMenuItem onClick={() => handleMarkLost(sample)}>
                                Mark Lost
                              </DropdownMenuItem>
                            )}
                            {sample.status === 'lost' && (
                              <DropdownMenuItem onClick={() => setMarkFoundSample(sample)}>
                                Mark Found
                              </DropdownMenuItem>
                            )}
                            {(user?.role === 'admin' || user?.role === 'manager') && sample.status === 'active' && (
                              <DropdownMenuItem onClick={() => handleRetire(sample)}>
                                Retire Sample
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {selectedSample && (
        <SampleDetailModal
          open={!!selectedSample}
          onClose={() => setSelectedSample(null)}
          sample={selectedSample}
        />
      )}

      {showCreateModal && (
        <CreateSampleModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {checkoutSample && (
        <CheckoutSampleModal
          open={!!checkoutSample}
          onClose={() => setCheckoutSample(null)}
          sample={checkoutSample}
          projects={projects}
        />
      )}

      {returnSample && (
        <ReturnSampleModal
          open={!!returnSample}
          onClose={() => setReturnSample(null)}
          sample={returnSample}
        />
      )}

      {transferSample && (
        <TransferSampleModal
          open={!!transferSample}
          onClose={() => setTransferSample(null)}
          sample={transferSample}
        />
      )}

      {markFoundSample && (
        <MarkFoundModal
          open={!!markFoundSample}
          onClose={() => setMarkFoundSample(null)}
          sample={markFoundSample}
        />
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmAction?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => confirmAction?.action()}
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}