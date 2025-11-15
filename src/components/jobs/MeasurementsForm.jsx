import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

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
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Checkbox
          checked={data.is_islo || false}
          onCheckedChange={updateIslo}
        />
        <Label>ISLO</Label>
      </div>

      <Card>
        <CardHeader className="p-3">
          <CardTitle className="text-sm">New Door Measurements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Left H</Label>
              <Input
                type="number"
                className="h-8 text-xs"
                value={data.new_door.height_left || ""}
                onChange={(e) => updateField('new_door', 'height_left', parseFloat(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-xs">Mid H</Label>
              <Input
                type="number"
                className="h-8 text-xs"
                value={data.new_door.height_mid || ""}
                onChange={(e) => updateField('new_door', 'height_mid', parseFloat(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-xs">Right H</Label>
              <Input
                type="number"
                className="h-8 text-xs"
                value={data.new_door.height_right || ""}
                onChange={(e) => updateField('new_door', 'height_right', parseFloat(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Top W</Label>
              <Input
                type="number"
                className="h-8 text-xs"
                value={data.new_door.width_top || ""}
                onChange={(e) => updateField('new_door', 'width_top', parseFloat(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-xs">Mid W</Label>
              <Input
                type="number"
                className="h-8 text-xs"
                value={data.new_door.width_mid || ""}
                onChange={(e) => updateField('new_door', 'width_mid', parseFloat(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-xs">Bottom W</Label>
              <Input
                type="number"
                className="h-8 text-xs"
                value={data.new_door.width_bottom || ""}
                onChange={(e) => updateField('new_door', 'width_bottom', parseFloat(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Left Sideroom</Label>
              <Input
                type="number"
                className="h-8 text-xs"
                value={data.new_door.sideroom_left || ""}
                onChange={(e) => updateField('new_door', 'sideroom_left', parseFloat(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-xs">Right Sideroom</Label>
              <Input
                type="number"
                className="h-8 text-xs"
                value={data.new_door.sideroom_right || ""}
                onChange={(e) => updateField('new_door', 'sideroom_right', parseFloat(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-xs">Headroom</Label>
              <Input
                type="number"
                className="h-8 text-xs"
                value={data.new_door.headroom || ""}
                onChange={(e) => updateField('new_door', 'headroom', parseFloat(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">Laser Floor</Label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs text-slate-500">Left Side</Label>
                <Input
                  type="number"
                  className="h-8 text-xs"
                  value={data.new_door.laser_floor_left || ""}
                  onChange={(e) => updateField('new_door', 'laser_floor_left', parseFloat(e.target.value))}
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500">Middle</Label>
                <Input
                  type="number"
                  className="h-8 text-xs"
                  value={data.new_door.laser_floor_mid || ""}
                  onChange={(e) => updateField('new_door', 'laser_floor_mid', parseFloat(e.target.value))}
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500">Right Side</Label>
                <Input
                  type="number"
                  className="h-8 text-xs"
                  value={data.new_door.laser_floor_right || ""}
                  onChange={(e) => updateField('new_door', 'laser_floor_right', parseFloat(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">Laser Top</Label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs text-slate-500">Left Side</Label>
                <Input
                  type="number"
                  className="h-8 text-xs"
                  value={data.new_door.laser_top_left || ""}
                  onChange={(e) => updateField('new_door', 'laser_top_left', parseFloat(e.target.value))}
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500">Middle</Label>
                <Input
                  type="number"
                  className="h-8 text-xs"
                  value={data.new_door.laser_top_mid || ""}
                  onChange={(e) => updateField('new_door', 'laser_top_mid', parseFloat(e.target.value))}
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500">Right Side</Label>
                <Input
                  type="number"
                  className="h-8 text-xs"
                  value={data.new_door.laser_top_right || ""}
                  onChange={(e) => updateField('new_door', 'laser_top_right', parseFloat(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Type</Label>
              <Input
                className="h-8 text-xs"
                value={data.new_door.type || ""}
                onChange={(e) => updateField('new_door', 'type', e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Finish</Label>
              <Input
                className="h-8 text-xs"
                value={data.new_door.finish || ""}
                onChange={(e) => updateField('new_door', 'finish', e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Colour</Label>
              <Input
                className="h-8 text-xs"
                value={data.new_door.colour || ""}
                onChange={(e) => updateField('new_door', 'colour', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-3">
          <CardTitle className="text-sm flex items-center gap-3">
            <span>Existing Door</span>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={data.existing_door.removal_required || false}
                onCheckedChange={(checked) => updateField('existing_door', 'removal_required', checked)}
              />
              <Label className="text-xs font-normal">Removal Required</Label>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Height Left Side</Label>
              <Input
                type="number"
                className="h-8 text-xs"
                value={data.existing_door.height_left || ""}
                onChange={(e) => updateField('existing_door', 'height_left', parseFloat(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-xs">Height Right Side</Label>
              <Input
                type="number"
                className="h-8 text-xs"
                value={data.existing_door.height_right || ""}
                onChange={(e) => updateField('existing_door', 'height_right', parseFloat(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-xs">Width</Label>
              <Input
                type="number"
                className="h-8 text-xs"
                value={data.existing_door.width || ""}
                onChange={(e) => updateField('existing_door', 'width', parseFloat(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Type</Label>
              <Input
                className="h-8 text-xs"
                value={data.existing_door.type || ""}
                onChange={(e) => updateField('existing_door', 'type', e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Finish</Label>
              <Input
                className="h-8 text-xs"
                value={data.existing_door.finish || ""}
                onChange={(e) => updateField('existing_door', 'finish', e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Colour</Label>
              <Input
                className="h-8 text-xs"
                value={data.existing_door.colour || ""}
                onChange={(e) => updateField('existing_door', 'colour', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-3">
          <CardTitle className="text-sm">Additional Information</CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <Textarea
            className="text-xs"
            value={data.additional_info || ""}
            onChange={(e) => updateAdditionalInfo(e.target.value)}
            rows={3}
          />
        </CardContent>
      </Card>
    </div>
  );
}