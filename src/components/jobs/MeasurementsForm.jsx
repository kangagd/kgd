import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function MeasurementsForm({ measurements, onChange }) {
  const [data, setData] = useState(() => {
    const initial = measurements || {};
    let new_doors = initial.new_doors || [];
    
    // Migration: if we have a single new_door object but no array, move it to array
    if (!new_doors.length && initial.new_door && Object.keys(initial.new_door).length > 0) {
      new_doors = [initial.new_door];
    }
    
    // Default to at least one door if empty
    if (!new_doors.length) {
      new_doors = [{}];
    }

    // Migration: Move global existing_door and additional_info to the first door if not present on doors
    // This ensures backward compatibility for data saved before this change
    new_doors = new_doors.map((door, index) => ({
      ...door,
      existing_door: door.existing_door || (index === 0 ? (initial.existing_door || { removal_required: "N" }) : { removal_required: "N" }),
      additional_info: door.additional_info || (index === 0 ? (initial.additional_info || "") : "")
    }));

    return {
      ...initial,
      new_doors
    };
  });

  const [activeTab, setActiveTab] = useState("door-0");

  const updateDoorField = (index, field, value) => {
    const updatedDoors = [...data.new_doors];
    updatedDoors[index] = {
      ...updatedDoors[index],
      [field]: value
    };
    
    const updatedData = {
      ...data,
      new_doors: updatedDoors,
      new_door: index === 0 ? updatedDoors[0] : data.new_door // Legacy sync
    };
    
    setData(updatedData);
    onChange(updatedData);
  };

  const updateDoorNestedField = (index, parentField, field, value) => {
    const updatedDoors = [...data.new_doors];
    updatedDoors[index] = {
      ...updatedDoors[index],
      [parentField]: {
        ...(updatedDoors[index][parentField] || {}),
        [field]: value
      }
    };
    
    const updatedData = {
      ...data,
      new_doors: updatedDoors,
    };
    
    setData(updatedData);
    onChange(updatedData);
  };

  const addDoor = () => {
    const newIndex = data.new_doors.length;
    const updatedDoors = [...data.new_doors, {
      existing_door: { removal_required: "N" },
      additional_info: ""
    }];
    const updatedData = { ...data, new_doors: updatedDoors };
    
    setData(updatedData);
    onChange(updatedData);
    setActiveTab(`door-${newIndex}`);
  };

  const removeDoor = (index, e) => {
    e.stopPropagation();
    if (data.new_doors.length <= 1) return;

    const updatedDoors = data.new_doors.filter((_, i) => i !== index);
    const updatedData = { 
      ...data, 
      new_doors: updatedDoors,
      new_door: index === 0 && updatedDoors.length > 0 ? updatedDoors[0] : (index === 0 ? {} : data.new_door)
    };
    
    setData(updatedData);
    onChange(updatedData);
    setActiveTab("door-0");
  };

  // Validation errors for a specific door
  const getValidationErrors = (door) => {
    const errors = {};
    
    if (!door) return errors;

    // Height validation: Left H, Mid H, Right H variance > 200mm
    const heights = [
      door.height_left,
      door.height_mid,
      door.height_right
    ].filter(v => v != null && !isNaN(v));
    
    if (heights.length >= 2) {
      const maxHeight = Math.max(...heights);
      const minHeight = Math.min(...heights);
      if (maxHeight - minHeight > 200) {
        errors.height = `Height variance of ${Math.round(maxHeight - minHeight)}mm exceeds 200mm threshold`;
      }
    }
    
    // Width validation: Top W, Mid W, Bottom W variance > 100mm
    const widths = [
      door.width_top,
      door.width_mid,
      door.width_bottom
    ].filter(v => v != null && !isNaN(v));
    
    if (widths.length >= 2) {
      const maxWidth = Math.max(...widths);
      const minWidth = Math.min(...widths);
      if (maxWidth - minWidth > 100) {
        errors.width = `Width variance of ${Math.round(maxWidth - minWidth)}mm exceeds 100mm threshold`;
      }
    }
    
    return errors;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Measurements</CardTitle>
            <Button onClick={addDoor} size="sm" variant="outline" className="gap-1">
              <Plus className="w-4 h-4" />
              Add Door
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full justify-start mb-4 overflow-x-auto flex-nowrap h-auto p-1 bg-slate-100">
              {data.new_doors.map((door, index) => (
                <TabsTrigger 
                  key={`door-${index}`} 
                  value={`door-${index}`}
                  className="flex items-center gap-2 px-3 py-1.5"
                >
                  <span>Door {index + 1}</span>
                  {data.new_doors.length > 1 && (
                    <div 
                      onClick={(e) => removeDoor(index, e)}
                      className="p-0.5 hover:bg-red-100 rounded-full text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </div>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {data.new_doors.map((door, index) => {
              const errors = getValidationErrors(door);
              const existingDoor = door.existing_door || { removal_required: "N" };
              
              return (
                <TabsContent key={`door-${index}`} value={`door-${index}`} className="space-y-6 mt-0">
                  
                  {/* NEW DOOR SECTION */}
                  <div className="space-y-4 border rounded-lg p-4 bg-slate-50/50">
                    <h3 className="font-semibold text-sm text-slate-900">New Door Specifications</h3>
                    
                    {/* Height Section */}
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label>Left H</Label>
                          <Input
                            type="number"
                            value={door.height_left || ""}
                            onChange={(e) => updateDoorField(index, 'height_left', parseFloat(e.target.value))}
                            className={errors.height ? "border-amber-500" : ""}
                          />
                        </div>
                        <div>
                          <Label>Mid H</Label>
                          <Input
                            type="number"
                            value={door.height_mid || ""}
                            onChange={(e) => updateDoorField(index, 'height_mid', parseFloat(e.target.value))}
                            className={errors.height ? "border-amber-500" : ""}
                          />
                        </div>
                        <div>
                          <Label>Right H</Label>
                          <Input
                            type="number"
                            value={door.height_right || ""}
                            onChange={(e) => updateDoorField(index, 'height_right', parseFloat(e.target.value))}
                            className={errors.height ? "border-amber-500" : ""}
                          />
                        </div>
                      </div>
                      {errors.height && (
                        <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 border border-amber-200 rounded-md p-2">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          <span>{errors.height}</span>
                        </div>
                      )}
                    </div>

                    {/* Width Section */}
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label>Top W</Label>
                          <Input
                            type="number"
                            value={door.width_top || ""}
                            onChange={(e) => updateDoorField(index, 'width_top', parseFloat(e.target.value))}
                            className={errors.width ? "border-amber-500" : ""}
                          />
                        </div>
                        <div>
                          <Label>Mid W</Label>
                          <Input
                            type="number"
                            value={door.width_mid || ""}
                            onChange={(e) => updateDoorField(index, 'width_mid', parseFloat(e.target.value))}
                            className={errors.width ? "border-amber-500" : ""}
                          />
                        </div>
                        <div>
                          <Label>Bottom W</Label>
                          <Input
                            type="number"
                            value={door.width_bottom || ""}
                            onChange={(e) => updateDoorField(index, 'width_bottom', parseFloat(e.target.value))}
                            className={errors.width ? "border-amber-500" : ""}
                          />
                        </div>
                      </div>
                      {errors.width && (
                        <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 border border-amber-200 rounded-md p-2">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          <span>{errors.width}</span>
                        </div>
                      )}
                    </div>

                    {/* Sideroom & Headroom */}
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Left Sideroom</Label>
                        <Input
                          type="number"
                          value={door.sideroom_left || ""}
                          onChange={(e) => updateDoorField(index, 'sideroom_left', parseFloat(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label>Right Sideroom</Label>
                        <Input
                          type="number"
                          value={door.sideroom_right || ""}
                          onChange={(e) => updateDoorField(index, 'sideroom_right', parseFloat(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label>Headroom</Label>
                        <Input
                          type="number"
                          value={door.headroom || ""}
                          onChange={(e) => updateDoorField(index, 'headroom', parseFloat(e.target.value))}
                        />
                      </div>
                    </div>

                    {/* Laser Floor */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Laser Floor</Label>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label className="text-xs">Left Side</Label>
                          <Input
                            type="number"
                            value={door.laser_floor_left || ""}
                            onChange={(e) => updateDoorField(index, 'laser_floor_left', parseFloat(e.target.value))}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Middle</Label>
                          <Input
                            type="number"
                            value={door.laser_floor_mid || ""}
                            onChange={(e) => updateDoorField(index, 'laser_floor_mid', parseFloat(e.target.value))}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Right Side</Label>
                          <Input
                            type="number"
                            value={door.laser_floor_right || ""}
                            onChange={(e) => updateDoorField(index, 'laser_floor_right', parseFloat(e.target.value))}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Laser Top */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Laser Top</Label>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label className="text-xs">Left Side</Label>
                          <Input
                            type="number"
                            value={door.laser_top_left || ""}
                            onChange={(e) => updateDoorField(index, 'laser_top_left', parseFloat(e.target.value))}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Middle</Label>
                          <Input
                            type="number"
                            value={door.laser_top_mid || ""}
                            onChange={(e) => updateDoorField(index, 'laser_top_mid', parseFloat(e.target.value))}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Right Side</Label>
                          <Input
                            type="number"
                            value={door.laser_top_right || ""}
                            onChange={(e) => updateDoorField(index, 'laser_top_right', parseFloat(e.target.value))}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Type, Finish, Colour */}
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Type</Label>
                        <Input
                          value={door.type || ""}
                          onChange={(e) => updateDoorField(index, 'type', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Finish</Label>
                        <Input
                          value={door.finish || ""}
                          onChange={(e) => updateDoorField(index, 'finish', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Colour</Label>
                        <Input
                          value={door.colour || ""}
                          onChange={(e) => updateDoorField(index, 'colour', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* EXISTING DOOR SECTION */}
                  <div className="space-y-4 border rounded-lg p-4 bg-white shadow-sm">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm text-slate-900">Existing Door Details</h3>
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-normal">Removal Required:</Label>
                        <select
                          value={existingDoor.removal_required || "N"}
                          onChange={(e) => updateDoorNestedField(index, 'existing_door', 'removal_required', e.target.value)}
                          className="h-9 px-3 rounded-md border border-[#E5E7EB] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                        >
                          <option value="N">No</option>
                          <option value="Y">Yes</option>
                        </select>
                      </div>
                    </div>

                    {existingDoor.removal_required === "Y" && (
                      <div className="space-y-4 pt-2">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label>Height Left Side</Label>
                            <Input
                              type="number"
                              value={existingDoor.height_left || ""}
                              onChange={(e) => updateDoorNestedField(index, 'existing_door', 'height_left', parseFloat(e.target.value))}
                            />
                          </div>
                          <div>
                            <Label>Height Right Side</Label>
                            <Input
                              type="number"
                              value={existingDoor.height_right || ""}
                              onChange={(e) => updateDoorNestedField(index, 'existing_door', 'height_right', parseFloat(e.target.value))}
                            />
                          </div>
                          <div>
                            <Label>Width</Label>
                            <Input
                              type="number"
                              value={existingDoor.width || ""}
                              onChange={(e) => updateDoorNestedField(index, 'existing_door', 'width', parseFloat(e.target.value))}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label>Type</Label>
                            <Input
                              value={existingDoor.type || ""}
                              onChange={(e) => updateDoorNestedField(index, 'existing_door', 'type', e.target.value)}
                            />
                          </div>
                          <div>
                            <Label>Finish</Label>
                            <Input
                              value={existingDoor.finish || ""}
                              onChange={(e) => updateDoorNestedField(index, 'existing_door', 'finish', e.target.value)}
                            />
                          </div>
                          <div>
                            <Label>Colour</Label>
                            <Input
                              value={existingDoor.colour || ""}
                              onChange={(e) => updateDoorNestedField(index, 'existing_door', 'colour', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ADDITIONAL INFO SECTION */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Additional Information (Door {index + 1})</Label>
                    <Textarea
                      value={door.additional_info || ""}
                      onChange={(e) => updateDoorField(index, 'additional_info', e.target.value)}
                      rows={3}
                      placeholder="Any specific notes for this door..."
                    />
                  </div>

                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}