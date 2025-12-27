import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AddIconButton } from "@/components/ui/AddIconButton";
import { Plus, X } from "lucide-react";
import MeasurementsForm from "../jobs/MeasurementsForm";
import InitialVisitSummary from "./InitialVisitSummary";

import ProjectContactsPanel from "./ProjectContactsPanel";
import RichTextField from "../common/RichTextField";

export default function RequirementsTab({ project, onUpdateProject, canEdit }) {
  const [showAddDoor, setShowAddDoor] = React.useState(false);
  const [newDoor, setNewDoor] = React.useState({ height: "", width: "", type: "", style: "" });
  const [specialRequirements, setSpecialRequirements] = React.useState(project.special_requirements || "");

  const handleAddDoor = () => {
    if (!newDoor.height && !newDoor.width && !newDoor.type) return;
    const currentDoors = project.doors || [];
    onUpdateProject({ doors: [...currentDoors, newDoor] });
    setNewDoor({ height: "", width: "", type: "", style: "" });
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

  return (
    <div className="space-y-6">
      {/* Door Measurements */}
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

      {/* Special Requirements */}
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

      {/* Visits Context */}
      {project.initial_visit_job_id && (
        <Card className="border border-[#E5E7EB] shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-[16px] font-semibold text-[#111827]">Initial Site Visit</CardTitle>
          </CardHeader>
          <CardContent>
            <InitialVisitSummary project={project} />
          </CardContent>
        </Card>
      )}

      {/* Project Contacts */}
      <ProjectContactsPanel project={project} />


    </div>
  );
}