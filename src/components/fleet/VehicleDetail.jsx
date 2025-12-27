import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Upload, Image as ImageIcon, Wrench, Package, Car } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import VehicleFormModal from "./VehicleFormModal";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import LocationBadge from "@/components/common/LocationBadge";
import VehicleSamplesPanel from "./VehicleSamplesPanel";

export default function VehicleDetail({ vehicle, onBack }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("samples");
  const [showEditModal, setShowEditModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const { data: photos = [] } = useQuery({
    queryKey: ['vehiclePhotos', vehicle.id],
    queryFn: () => base44.entities.Photo.filter({ vehicle_id: vehicle.id }, '-uploaded_at')
  });

  const { data: vehicleTools = [], isLoading: vehicleToolsLoading } = useQuery({
    queryKey: ["vehicle-tools", vehicle.id],
    queryFn: async () => {
      return base44.entities.VehicleTool.filter({ vehicle_id: vehicle.id });
    },
  });

  const { data: toolItems = [] } = useQuery({
    queryKey: ["tool-items"],
    queryFn: () => base44.entities.ToolItem.list("name"),
  });

  const toolItemMap = React.useMemo(() => {
    const map = {};
    for (const t of toolItems) {
      if (t.is_active !== false) {
        map[t.id] = t;
      }
    }
    return map;
  }, [toolItems]);

  const activeVehicleTools = React.useMemo(() => {
    return vehicleTools.filter(vt => vt.tool_item_id && toolItemMap[vt.tool_item_id]);
  }, [vehicleTools, toolItemMap]);

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        const user = await base44.auth.me();
        
        await base44.entities.Photo.create({
          image_url: file_url,
          vehicle_id: vehicle.id,
          uploaded_at: new Date().toISOString(),
          technician_email: user?.email,
          technician_name: user?.display_name || user?.full_name,
          tags: ["Vehicle"],
          notes: "Uploaded from vehicle details"
        });
      }
      queryClient.invalidateQueries({ queryKey: ['vehiclePhotos', vehicle.id] });
      toast.success(`${files.length} photo(s) uploaded`);
    } catch (error) {
      console.error("Upload failed", error);
      toast.error("Failed to upload photos");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Button variant="ghost" onClick={onBack} className="mb-4 pl-0 hover:bg-transparent hover:text-gray-600">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Fleet
      </Button>

      <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
        <div className="flex items-start gap-6">
          <div className="w-24 h-24 rounded-xl bg-gray-100 border-2 border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
            {vehicle.photo_url ? (
              <img src={vehicle.photo_url} alt={vehicle.name} className="w-full h-full object-cover" />
            ) : (
              <Car className="w-10 h-10 text-gray-400" />
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{vehicle.name}</h1>
            <div className="flex items-center gap-3 mt-2 text-gray-600">
              <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{vehicle.registration_plate}</span>
              <span>•</span>
              <span>{vehicle.status}</span>
              <span>•</span>
              <span>{vehicle.assigned_user_name || "Unassigned"}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowEditModal(true)}>
            <Car className="w-4 h-4 mr-2" />
            Edit Vehicle
          </Button>
        </div>
      </div>

      <VehicleFormModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        vehicle={vehicle}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white border border-gray-200 p-1 h-auto">
          <TabsTrigger value="samples" className="px-6 py-2">Samples</TabsTrigger>
          <TabsTrigger value="tools" className="px-6 py-2">Tools</TabsTrigger>
          <TabsTrigger value="photos" className="px-6 py-2">Photos</TabsTrigger>
          <TabsTrigger value="overview" className="px-6 py-2">Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="samples">
          <VehicleSamplesPanel vehicle={vehicle} />
        </TabsContent>

        <TabsContent value="tools">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-slate-600" />
                Tools
              </CardTitle>
            </CardHeader>
            <CardContent>
              {vehicleToolsLoading ? (
                <div className="text-center py-8 text-gray-500">Loading tools...</div>
              ) : activeVehicleTools.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No tools assigned to this vehicle yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(
                    activeVehicleTools.reduce((acc, vt) => {
                      const tool = toolItemMap[vt.tool_item_id];
                      const location = vt.location || tool?.category || "Other";
                      if (!acc[location]) acc[location] = [];
                      acc[location].push({ vehicleTool: vt, toolItem: tool });
                      return acc;
                    }, {})
                  ).map(([location, items]) => (
                    <div key={location} className="border rounded-xl bg-gray-50 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <LocationBadge location={location} />
                        <span className="text-xs text-gray-500">
                          {items.length} tool{items.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {items.map(({ vehicleTool, toolItem }) => {
                          const required = vehicleTool.quantity_required ?? 0;
                          const onHand = vehicleTool.quantity_on_hand ?? 0;
                          const missingCount = Math.max(0, required - onHand);
                          const isMissing = required > 0 && onHand < required;

                          return (
                            <div
                              key={vehicleTool.id}
                              className="flex items-center justify-between text-sm py-2 px-3 bg-white rounded-lg"
                            >
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">
                                  {toolItem?.name || "Unknown Tool"}
                                </div>
                                {toolItem?.notes && (
                                  <div className="text-xs text-gray-500 truncate max-w-md">
                                    {toolItem.notes}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-600 font-mono">
                                  {onHand} / {required}
                                </span>
                                {isMissing ? (
                                  <Badge
                                    variant="outline"
                                    className="bg-red-50 text-red-700 border-red-200 text-xs"
                                  >
                                    Missing {missingCount}
                                  </Badge>
                                ) : (
                                  required > 0 && (
                                    <Badge
                                      variant="outline"
                                      className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs"
                                    >
                                      OK
                                    </Badge>
                                  )
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="photos">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Vehicle Photos</CardTitle>
              <div className="flex gap-2">
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm" disabled={isUploading} asChild>
                    <span>
                      <Upload className="w-4 h-4 mr-2" />
                      {isUploading ? "Uploading..." : "Upload Photos"}
                    </span>
                  </Button>
                  <input 
                    type="file" 
                    multiple 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handlePhotoUpload}
                    disabled={isUploading}
                  />
                </label>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {vehicle.photo_url && (
                  <div className="aspect-square rounded-lg overflow-hidden border border-gray-200 relative group">
                    <img src={vehicle.photo_url} alt="Profile" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-white text-xs font-medium px-2 py-1 bg-black/50 rounded">Profile Photo</span>
                    </div>
                  </div>
                )}
                
                {photos.map(photo => (
                  <div key={photo.id} className="aspect-square rounded-lg overflow-hidden border border-gray-200 relative group">
                    <img src={photo.image_url} alt="Vehicle Photo" className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="text-white text-xs truncate">
                        {format(new Date(photo.uploaded_at), 'MMM d, yyyy')}
                      </div>
                      <div className="text-gray-300 text-[10px] truncate">
                        by {photo.technician_name || 'Unknown'}
                      </div>
                    </div>
                  </div>
                ))}
                
                {!vehicle.photo_url && photos.length === 0 && (
                  <div className="col-span-full py-12 text-center text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                    <ImageIcon className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                    <p>No photos available</p>
                    <p className="text-sm mt-1">Upload photos to track vehicle condition</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Vehicle Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-gray-500">Name</div>
                  <div className="font-medium">{vehicle.name}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Primary Location</div>
                  <div className="font-medium">{vehicle.primary_location || "-"}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Notes</div>
                  <div className="text-sm mt-1 bg-gray-50 p-3 rounded-lg">{vehicle.notes || "No notes"}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}