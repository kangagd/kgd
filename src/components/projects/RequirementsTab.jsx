import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AddIconButton } from "@/components/ui/AddIconButton";
import { Plus, X, CheckCircle2, Circle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MeasurementsForm from "../jobs/MeasurementsForm";
import ThirdPartyTradesPanel from "./ThirdPartyTradesPanel";
import ProjectContactsPanel from "./ProjectContactsPanel";
import RichTextField from "../common/RichTextField";
import { base44 } from "@/api/base44Client";

export default function RequirementsTab({ project, onUpdateProject, canEdit }) {
  const [showAddDoor, setShowAddDoor] = React.useState(false);
  const [newDoor, setNewDoor] = React.useState({ height: "", width: "", type: "", style: "", measurement_type: "initial" });
  const [specialRequirements, setSpecialRequirements] = React.useState(project.special_requirements || "");

  const isRepairOrMaintenance = project.project_type === "Repair" || project.project_type === "Maintenance";
  const isInstallProject = ["Garage Door Install", "Gate Install", "Roller Shutter Install", "Multiple"].includes(project.project_type);

  // Initialize checklist if empty and project is in Create Quote stage
  React.useEffect(() => {
    if (isInstallProject && project.status === "Create Quote" && (!project.quote_checklist || project.quote_checklist.length === 0)) {
      onUpdateProject({
        quote_checklist: [
          { item: "Pricing Requested", checked: false },
          { item: "Pricing Received", checked: false }
        ]
      });
    }
  }, [project.status, project.quote_checklist, isInstallProject]);

  const handleAddDoor = () => {
    if (!newDoor.height && !newDoor.width && !newDoor.type) return;
    const currentDoors = project.doors || [];
    onUpdateProject({ doors: [...currentDoors, newDoor] });
    setNewDoor({ height: "", width: "", type: "", style: "", measurement_type: "initial" });
    setShowAddDoor(false);
  };

  const handleRemoveDoor = (indexToRemove) => {
    const updatedDoors = project.doors.filter((_, index) => index !== indexToRemove);
    onUpdateProject({ doors: updatedDoors });
  };

  const handleSpecialRequirementsBlur = () => {
    if (specialRequirements !== (project.special_requirements || "")) {
      onUpdateProject({ special_requirements: specialRequirements });
    }
  };

  const handleChecklistToggle = async (index) => {
    if (!canEdit) return;
    
    const user = await base44.auth.me();
    const currentChecklist = project.quote_checklist || [];
    const updatedChecklist = [...currentChecklist];
    const item = updatedChecklist[index];
    
    updatedChecklist[index] = {
      ...item,
      checked: !item.checked,
      checked_at: !item.checked ? new Date().toISOString() : null,
      checked_by: !item.checked ? user.email : null
    };
    
    await onUpdateProject({ quote_checklist: updatedChecklist });
  };

  return (
    <div className="space-y-6">
      {/* Door Measurements - Only show for install projects */}
      {!isRepairOrMaintenance && (
      <Card className="border border-[#E5E7EB] shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[16px] font-semibold text-[#111827]">Door Measurements</CardTitle>
            {canEdit && !showAddDoor && (
              <AddIconButton
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAddDoor(true);
                }}
                title="Add Door"
              />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {(!project.doors || project.doors.length === 0) && !showAddDoor ? (
            <div className="text-center py-6 text-[14px] text-[#9CA3AF]">
              No doors added yet
            </div>
          ) : (
            <div className="space-y-3">
              {project.doors && project.doors.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {project.doors.map((door, idx) => (
                    <div key={idx} className="relative group">
                      <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700 font-medium px-3 py-1.5 text-sm pr-8">
                        <span className="text-[10px] font-semibold uppercase mr-2 text-blue-600">
                          {door.measurement_type === "initial" ? "Initial" : door.measurement_type === "quote" ? "Quote" : door.measurement_type === "order" ? "Order" : "Initial"}
                        </span>
                        Door {idx + 1}: {door.height && door.width ? `${door.height} × ${door.width}` : 'Pending specs'}
                        {door.type && ` • ${door.type}`}
                        {door.style && ` • ${door.style}`}
                      </Badge>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveDoor(idx);
                          }}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {showAddDoor && canEdit && (
                <div className="border border-[#E5E7EB] rounded-lg p-3 bg-[#F8F9FA] mt-3">
                  <div className="mb-3">
                    <label className="text-xs font-medium text-gray-700 mb-1 block">Measurement Type</label>
                    <Select
                      value={newDoor.measurement_type || "initial"}
                      onValueChange={(value) => setNewDoor({ ...newDoor, measurement_type: value })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="initial">Initial (Rough Measurements)</SelectItem>
                        <SelectItem value="quote">Quote (Final Measure)</SelectItem>
                        <SelectItem value="order">Order (For Manufacturer)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                    <Input
                      placeholder="Height"
                      value={newDoor.height}
                      onChange={(e) => setNewDoor({ ...newDoor, height: e.target.value })}
                    />
                    <Input
                      placeholder="Width"
                      value={newDoor.width}
                      onChange={(e) => setNewDoor({ ...newDoor, width: e.target.value })}
                    />
                    <Input
                      placeholder="Type (e.g. Sectional, Roller)"
                      value={newDoor.type}
                      onChange={(e) => setNewDoor({ ...newDoor, type: e.target.value })}
                    />
                    <Input
                      placeholder="Style"
                      value={newDoor.style}
                      onChange={(e) => setNewDoor({ ...newDoor, style: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" onClick={handleAddDoor} size="sm" className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]">
                      <Plus className="w-4 h-4 mr-1" />
                      Add Door
                    </Button>
                    <Button type="button" onClick={() => setShowAddDoor(false)} size="sm" variant="outline">
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Quote Preparation Checklist - Only for install projects */}
      {isInstallProject && (
        <Card className="border border-[#E5E7EB] shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-[16px] font-semibold text-[#111827]">Quote Preparation</CardTitle>
          </CardHeader>
          <CardContent>
            {(!project.quote_checklist || project.quote_checklist.length === 0) ? (
              <div className="text-sm text-[#6B7280]">
                Checklist will appear when project moves to "Create Quote" stage
              </div>
            ) : (
              <div className="space-y-2">
                {project.quote_checklist.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleChecklistToggle(idx)}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                      canEdit ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'
                    } ${item.checked ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'}`}
                  >
                    {item.checked ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className={`text-sm font-medium ${item.checked ? 'text-green-900' : 'text-gray-900'}`}>
                        {item.item}
                      </div>
                      {item.checked && item.checked_at && (
                        <div className="text-xs text-green-700 mt-0.5">
                          Checked by {item.checked_by?.split('@')[0] || 'user'} on {new Date(item.checked_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Special Requirements - Only show for install projects */}
      {!isRepairOrMaintenance && (
      <Card className="border border-[#E5E7EB] shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-[16px] font-semibold text-[#111827]">Special Requirements</CardTitle>
        </CardHeader>
        <CardContent>
          <RichTextField
            value={specialRequirements}
            onChange={setSpecialRequirements}
            onBlur={handleSpecialRequirementsBlur}
            placeholder="Add any special requirements or notes for this installation..."
            readOnly={!canEdit}
          />
        </CardContent>
      </Card>
      )}

      {/* Deprecated: Initial Site Visit removed - unified in VisitsTimeline */}

      {/* Project Contacts - Always show */}
      <ProjectContactsPanel project={project} />

      {/* Third Party Trades - Always show */}
      <Card className="border border-[#E5E7EB] shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-[16px] font-semibold text-[#111827]">Third Party Trades</CardTitle>
        </CardHeader>
        <CardContent>
          <ThirdPartyTradesPanel 
            project={project}
            canEdit={canEdit}
          />
        </CardContent>
      </Card>
    </div>
  );
}