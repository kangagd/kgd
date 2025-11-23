import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle } from "lucide-react";

export default function MeasurementsForm({ measurements, onChange }) {
  const [data, setData] = useState(measurements || {
    new_door: {},
    existing_door: { removal_required: false },
    additional_info: "",
    is_islo: false
  });

  const updateField = (section, field, value) => {
    const updated = {
      ...data,
      [section]: {
        ...data[section],
        [field]: value
      }
    };
    setData(updated);
    onChange(updated);
  };

  const validationErrors = useMemo(() => {
    const errors = {};
    
    // Height validation: Left H, Mid H, Right H variance > 200mm
    const heights = [
      data.new_door.height_left,
      data.new_door.height_mid,
      data.new_door.height_right
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
      data.new_door.width_top,
      data.new_door.width_mid,
      data.new_door.width_bottom
    ].filter(v => v != null && !isNaN(v));
    
    if (widths.length >= 2) {
      const maxWidth = Math.max(...widths);
      const minWidth = Math.min(...widths);
      if (maxWidth - minWidth > 100) {
        errors.width = `Width variance of ${Math.round(maxWidth - minWidth)}mm exceeds 100mm threshold`;
      }
    }
    
    return errors;
  }, [data.new_door]);

  const updateAdditionalInfo = (value) => {
    const updated = { ...data, additional_info: value };
    setData(updated);
    onChange(updated);
  };

  const updateIslo = (value) => {
    const updated = { ...data, is_islo: value };
    setData(updated);
    onChange(updated);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>New Door Measurements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Left H</Label>
                <Input
                  type="number"
                  value={data.new_door.height_left || ""}
                  onChange={(e) => updateField('new_door', 'height_left', parseFloat(e.target.value))}
                  className={validationErrors.height ? "border-amber-500" : ""}
                />
              </div>
              <div>
                <Label>Mid H</Label>
                <Input
                  type="number"
                  value={data.new_door.height_mid || ""}
                  onChange={(e) => updateField('new_door', 'height_mid', parseFloat(e.target.value))}
                  className={validationErrors.height ? "border-amber-500" : ""}
                />
              </div>
              <div>
                <Label>Right H</Label>
                <Input
                  type="number"
                  value={data.new_door.height_right || ""}
                  onChange={(e) => updateField('new_door', 'height_right', parseFloat(e.target.value))}
                  className={validationErrors.height ? "border-amber-500" : ""}
                />
              </div>
            </div>
            {validationErrors.height && (
              <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 border border-amber-200 rounded-md p-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{validationErrors.height}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Top W</Label>
                <Input
                  type="number"
                  value={data.new_door.width_top || ""}
                  onChange={(e) => updateField('new_door', 'width_top', parseFloat(e.target.value))}
                  className={validationErrors.width ? "border-amber-500" : ""}
                />
              </div>
              <div>
                <Label>Mid W</Label>
                <Input
                  type="number"
                  value={data.new_door.width_mid || ""}
                  onChange={(e) => updateField('new_door', 'width_mid', parseFloat(e.target.value))}
                  className={validationErrors.width ? "border-amber-500" : ""}
                />
              </div>
              <div>
                <Label>Bottom W</Label>
                <Input
                  type="number"
                  value={data.new_door.width_bottom || ""}
                  onChange={(e) => updateField('new_door', 'width_bottom', parseFloat(e.target.value))}
                  className={validationErrors.width ? "border-amber-500" : ""}
                />
              </div>
            </div>
            {validationErrors.width && (
              <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 border border-amber-200 rounded-md p-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{validationErrors.width}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Left Sideroom</Label>
              <Input
                type="number"
                value={data.new_door.sideroom_left || ""}
                onChange={(e) => updateField('new_door', 'sideroom_left', parseFloat(e.target.value))}
              />
            </div>
            <div>
              <Label>Right Sideroom</Label>
              <Input
                type="number"
                value={data.new_door.sideroom_right || ""}
                onChange={(e) => updateField('new_door', 'sideroom_right', parseFloat(e.target.value))}
              />
            </div>
            <div>
              <Label>Headroom</Label>
              <Input
                type="number"
                value={data.new_door.headroom || ""}
                onChange={(e) => updateField('new_door', 'headroom', parseFloat(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">Laser Floor</Label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs">Left Side</Label>
                <Input
                  type="number"
                  value={data.new_door.laser_floor_left || ""}
                  onChange={(e) => updateField('new_door', 'laser_floor_left', parseFloat(e.target.value))}
                />
              </div>
              <div>
                <Label className="text-xs">Middle</Label>
                <Input
                  type="number"
                  value={data.new_door.laser_floor_mid || ""}
                  onChange={(e) => updateField('new_door', 'laser_floor_mid', parseFloat(e.target.value))}
                />
              </div>
              <div>
                <Label className="text-xs">Right Side</Label>
                <Input
                  type="number"
                  value={data.new_door.laser_floor_right || ""}
                  onChange={(e) => updateField('new_door', 'laser_floor_right', parseFloat(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">Laser Top</Label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs">Left Side</Label>
                <Input
                  type="number"
                  value={data.new_door.laser_top_left || ""}
                  onChange={(e) => updateField('new_door', 'laser_top_left', parseFloat(e.target.value))}
                />
              </div>
              <div>
                <Label className="text-xs">Middle</Label>
                <Input
                  type="number"
                  value={data.new_door.laser_top_mid || ""}
                  onChange={(e) => updateField('new_door', 'laser_top_mid', parseFloat(e.target.value))}
                />
              </div>
              <div>
                <Label className="text-xs">Right Side</Label>
                <Input
                  type="number"
                  value={data.new_door.laser_top_right || ""}
                  onChange={(e) => updateField('new_door', 'laser_top_right', parseFloat(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Type</Label>
              <Input
                value={data.new_door.type || ""}
                onChange={(e) => updateField('new_door', 'type', e.target.value)}
              />
            </div>
            <div>
              <Label>Finish</Label>
              <Input
                value={data.new_door.finish || ""}
                onChange={(e) => updateField('new_door', 'finish', e.target.value)}
              />
            </div>
            <div>
              <Label>Colour</Label>
              <Input
                value={data.new_door.colour || ""}
                onChange={(e) => updateField('new_door', 'colour', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <span>Existing Door</span>
            <div className="flex items-center gap-2">
              <Label className="text-sm font-normal">Removal Required:</Label>
              <select
                value={data.existing_door.removal_required || "N"}
                onChange={(e) => updateField('existing_door', 'removal_required', e.target.value)}
                className="h-9 px-3 rounded-md border border-[#E5E7EB] bg-white text-sm"
              >
                <option value="N">N</option>
                <option value="Y">Y</option>
              </select>
            </div>
          </CardTitle>
        </CardHeader>
        {data.existing_door.removal_required === "Y" && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Height Left Side</Label>
              <Input
                type="number"
                value={data.existing_door.height_left || ""}
                onChange={(e) => updateField('existing_door', 'height_left', parseFloat(e.target.value))}
              />
            </div>
            <div>
              <Label>Height Right Side</Label>
              <Input
                type="number"
                value={data.existing_door.height_right || ""}
                onChange={(e) => updateField('existing_door', 'height_right', parseFloat(e.target.value))}
              />
            </div>
            <div>
              <Label>Width</Label>
              <Input
                type="number"
                value={data.existing_door.width || ""}
                onChange={(e) => updateField('existing_door', 'width', parseFloat(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Type</Label>
              <Input
                value={data.existing_door.type || ""}
                onChange={(e) => updateField('existing_door', 'type', e.target.value)}
              />
            </div>
            <div>
              <Label>Finish</Label>
              <Input
                value={data.existing_door.finish || ""}
                onChange={(e) => updateField('existing_door', 'finish', e.target.value)}
              />
            </div>
            <div>
              <Label>Colour</Label>
              <Input
                value={data.existing_door.colour || ""}
                onChange={(e) => updateField('existing_door', 'colour', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Additional Information</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={data.additional_info || ""}
            onChange={(e) => updateAdditionalInfo(e.target.value)}
            rows={4}
          />
        </CardContent>
      </Card>
    </div>
  );
}