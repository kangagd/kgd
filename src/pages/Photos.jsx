import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, Filter, X, Image as ImageIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PhotoUploadModal from "../components/photos/PhotoUploadModal";
import FilePreviewModal from "../components/common/FilePreviewModal";
import { useMutation } from "@tanstack/react-query";

const TAGS = ["Before", "After", "Install", "Repair", "Service", "Maintenance", "Marketing", "Other"];
const PRODUCT_TYPES = ["Garage Door", "Gate", "Roller Shutter", "Other"];

export default function Photos() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [productTypeFilter, setProductTypeFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [technicianFilter, setTechnicianFilter] = useState("all");
  const [marketingOnly, setMarketingOnly] = useState(false);
  const [preselectedJobId, setPreselectedJobId] = useState(null);
  const [preselectedProjectId, setPreselectedProjectId] = useState(null);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const jobId = params.get('jobId');
    const projectId = params.get('projectId');
    if (jobId) setPreselectedJobId(jobId);
    if (projectId) setPreselectedProjectId(projectId);
  }, []);

  const { data: allPhotos = [], isLoading } = useQuery({
    queryKey: ['photos'],
    queryFn: () => base44.entities.Photo.list('-uploaded_at'),
    refetchInterval: 15000, // Refetch every 15 seconds
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => base44.entities.User.filter({ is_field_technician: true })
  });

  const handleUploadComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['photos'] });
  };

  const deletePhotoMutation = useMutation({
    mutationFn: (photoId) => base44.entities.Photo.delete(photoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos'] });
      setSelectedPhoto(null);
    }
  });

  // Filters
  const filteredPhotos = allPhotos.filter(photo => {
    const matchesSearch =
      photo.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      photo.job_number?.toString().includes(searchTerm) ||
      photo.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      photo.project_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesProductType = productTypeFilter === "all" || photo.product_type === productTypeFilter;
    const matchesTag = tagFilter === "all" || (photo.tags && photo.tags.includes(tagFilter));
    const matchesTechnician = technicianFilter === "all" || photo.technician_email === technicianFilter;
    const matchesMarketing = !marketingOnly || photo.is_marketing_approved;
    const matchesJob = !preselectedJobId || photo.job_id === preselectedJobId;
    const matchesProject = !preselectedProjectId || photo.project_id === preselectedProjectId;

    return matchesSearch && matchesProductType && matchesTag && matchesTechnician && matchesMarketing && matchesJob && matchesProject;
  });

  const activeFiltersCount = 
    (productTypeFilter !== "all" ? 1 : 0) +
    (tagFilter !== "all" ? 1 : 0) +
    (technicianFilter !== "all" ? 1 : 0) +
    (marketingOnly ? 1 : 0);

  return (
    <div className="p-5 md:p-10 bg-[#F8F9FA] min-h-screen overflow-x-hidden">
      <div className="max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center w-full py-3 lg:py-4 mb-4 lg:mb-6 gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#111827] leading-tight">Photos</h1>
            <p className="text-sm text-[#4B5563] mt-1">
              Central media library for all job and project photos
            </p>
          </div>
          <Button
            onClick={() => setShowUploadModal(true)}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold shadow-sm hover:shadow-md transition w-full md:w-auto h-10 px-4 text-sm rounded-xl"
          >
            <Plus className="w-4 h-4 mr-2" />
            Upload Photos
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="mt-4 lg:mt-5 mb-6 space-y-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
              <Input
                placeholder="Search by job #, customer, address, project..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 border border-[#E5E7EB] focus:border-[#FAE008] focus:ring-2 focus:ring-[#FAE008]/20 transition-all h-12 text-base rounded-lg"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={`border border-[#E5E7EB] hover:bg-[#F3F4F6] font-semibold transition-all h-12 rounded-lg ${
                activeFiltersCount > 0 ? "border-[#FAE008] bg-[#FAE008]/10" : ""
              }`}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge className="ml-2 bg-[#FAE008] text-[#111827] px-2 py-0.5 text-xs font-bold">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </div>

          {showFilters && (
            <Card className="rounded-lg border border-[#E5E7EB]">
              <CardContent className="p-5">
                <div className="chip-container -mx-5 px-5 md:mx-0 md:px-0">
                  <div className="flex gap-3 pb-2 min-w-max md:min-w-0 md:flex-wrap">
                    <div className="min-w-[200px]">
                      <label className="text-xs font-bold text-[#111827] mb-1.5 block tracking-tight uppercase">
                        Product Type
                      </label>
                      <Select value={productTypeFilter} onValueChange={setProductTypeFilter}>
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          {PRODUCT_TYPES.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="min-w-[200px]">
                      <label className="text-xs font-bold text-[#111827] mb-1.5 block tracking-tight uppercase">
                        Tag
                      </label>
                      <Select value={tagFilter} onValueChange={setTagFilter}>
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Tags</SelectItem>
                          {TAGS.map(tag => (
                            <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="min-w-[200px]">
                      <label className="text-xs font-bold text-[#111827] mb-1.5 block tracking-tight uppercase">
                        Technician
                      </label>
                      <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Technicians</SelectItem>
                          {technicians.map(tech => (
                            <SelectItem key={tech.email} value={tech.email}>
                              {tech.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="min-w-[200px]">
                      <label className="text-xs font-bold text-[#111827] mb-1.5 block tracking-tight uppercase">
                        Marketing
                      </label>
                      <Button
                        variant={marketingOnly ? "default" : "outline"}
                        onClick={() => setMarketingOnly(!marketingOnly)}
                        className={`w-full h-10 justify-start font-semibold ${
                          marketingOnly ? "bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]" : ""
                        }`}
                      >
                        {marketingOnly ? "✓ " : ""}Approved Only
                      </Button>
                    </div>

                    {activeFiltersCount > 0 && (
                      <div className="min-w-[120px] flex items-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setProductTypeFilter("all");
                            setTagFilter("all");
                            setTechnicianFilter("all");
                            setMarketingOnly(false);
                          }}
                          className="w-full h-10 font-semibold"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Clear
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {(searchTerm || activeFiltersCount > 0) && (
            <div className="text-sm text-[#4B5563] font-semibold">
              Showing {filteredPhotos.length} of {allPhotos.length} photos
            </div>
          )}
        </div>

        {/* Photos Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <Card key={i} className="animate-pulse">
                <div className="aspect-square bg-[#E5E7EB] rounded-t-lg" />
                <CardContent className="p-3 space-y-2">
                  <div className="h-4 bg-[#E5E7EB] rounded w-3/4" />
                  <div className="h-3 bg-[#E5E7EB] rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredPhotos.length === 0 ? (
          <Card className="p-12 text-center">
            <ImageIcon className="w-16 h-16 mx-auto text-[#E5E7EB] mb-4" />
            <h3 className="text-[18px] font-semibold text-[#111827] leading-[1.2] mb-2">
              No photos found
            </h3>
            <p className="text-[14px] text-[#6B7280] leading-[1.4] mb-4">
              {searchTerm || activeFiltersCount > 0
                ? "Try adjusting your search or filters"
                : "Upload your first photos to get started"}
            </p>
            {!searchTerm && activeFiltersCount === 0 && (
              <Button
                onClick={() => setShowUploadModal(true)}
                className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07] font-semibold"
              >
                <Plus className="w-4 h-4 mr-2" />
                Upload Photos
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredPhotos.map(photo => (
              <Card
                key={photo.id}
                className="border border-[#E5E7EB] shadow-sm hover:border-[#FAE008] hover:shadow-md transition-all cursor-pointer group overflow-hidden"
                onClick={() => setSelectedPhoto(photo)}
              >
                <div className="aspect-square overflow-hidden bg-[#F8F9FA]">
                  <img
                    src={photo.image_url}
                    alt={photo.notes || 'Photo'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <CardContent className="p-3 space-y-2">
                  <div className="text-sm font-bold text-[#111827] leading-tight truncate">
                    {photo.job_number ? `#${photo.job_number}` : 'No Job'} - {photo.customer_name || 'Unknown'}
                  </div>
                  <div className="text-xs text-[#6B7280] truncate">
                    {photo.project_name || photo.address || photo.product_type || 'No details'}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {photo.tags?.slice(0, 2).map((tag, index) => (
                      <Badge
                        key={index}
                        className="bg-[#F3F4F6] text-[#4B5563] hover:bg-[#F3F4F6] border-0 font-medium text-[10px] px-1.5 py-0"
                      >
                        {tag}
                      </Badge>
                    ))}
                    {photo.product_type && (
                      <Badge className="bg-[#EDE9FE] text-[#6D28D9] border-0 font-medium text-[10px] px-1.5 py-0 hover:bg-[#EDE9FE]">
                        {photo.product_type}
                      </Badge>
                    )}
                    {photo.is_marketing_approved && (
                      <Badge className="bg-[#D1FAE5] text-[#065F46] border-0 font-medium text-[10px] px-1.5 py-0 hover:bg-[#D1FAE5]">
                        ✓
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <PhotoUploadModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadComplete={handleUploadComplete}
        preselectedJobId={preselectedJobId}
      />

      <FilePreviewModal
        isOpen={!!selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
        file={selectedPhoto ? {
          url: selectedPhoto.image_url,
          name: selectedPhoto.notes || `Photo - ${selectedPhoto.customer_name}`,
          type: 'image',
          jobNumber: selectedPhoto.job_number,
          projectName: selectedPhoto.project_name,
          address: selectedPhoto.address,
          caption: selectedPhoto.notes,
          takenAt: selectedPhoto.uploaded_at
        } : null}
        onDelete={() => deletePhotoMutation.mutate(selectedPhoto.id)}
      />
    </div>
  );
}