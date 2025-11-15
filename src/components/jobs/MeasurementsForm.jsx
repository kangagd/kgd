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
    additional_info: ""
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>New Door Measurements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Right H</Label>
              <Input
                type="number"
                placeholder="2249"
                value={data.new_door.height_right || ""}
                onChange={(e) => updateField('new_door', 'height_right', parseFloat(e.target.value))}
              />
            </div>
            <div>
              <Label>Mid H</Label>
              <Input
                type="number"
                placeholder="2305"
                value={data.new_door.height_mid || ""}
                onChange={(e) => updateField('new_door', 'height_mid', parseFloat(e.target.value))}
              />
            </div>
            <div>
              <Label>Left H</Label>
              <Input
                type="number"
                placeholder="2385"
                value={data.new_door.height_left || ""}
                onChange={(e) => updateField('new_door', 'height_left', parseFloat(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Top W</Label>
              <Input
                type="number"
                placeholder="4570"
                value={data.new_door.width_top || ""}
                onChange={(e) => updateField('new_door', 'width_top', parseFloat(e.target.value))}
              />
            </div>
            <div>
              <Label>Mid W</Label>
              <Input
                type="number"
                placeholder="4573"
                value={data.new_door.width_mid || ""}
                onChange={(e) => updateField('new_door', 'width_mid', parseFloat(e.target.value))}
              />
            </div>
            <div>
              <Label>Bottom W</Label>
              <Input
                type="number"
                placeholder="4588"
                value={data.new_door.width_bottom || ""}
                onChange={(e) => updateField('new_door', 'width_bottom', parseFloat(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Left Sideroom</Label>
              <Input
                type="number"
                placeholder="190"
                value={data.new_door.sideroom_left || ""}
                onChange={(e) => updateField('new_door', 'sideroom_left', parseFloat(e.target.value))}
              />
            </div>
            <div>
              <Label>Right Sideroom</Label>
              <Input
                type="number"
                placeholder="220"
                value={data.new_door.sideroom_right || ""}
                onChange={(e) => updateField('new_door', 'sideroom_right', parseFloat(e.target.value))}
              />
            </div>
            <div>
              <Label>Headroom</Label>
              <Input
                type="number"
                placeholder="700"
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
                  placeholder="359"
                  value={data.new_door.laser_floor_left || ""}
                  onChange={(e) => updateField('new_door', 'laser_floor_left', parseFloat(e.target.value))}
                />
              </div>
              <div>
                <Label className="text-xs">Middle</Label>
                <Input
                  type="number"
                  placeholder="293"
                  value={data.new_door.laser_floor_mid || ""}
                  onChange={(e) => updateField('new_door', 'laser_floor_mid', parseFloat(e.target.value))}
                />
              </div>
              <div>
                <Label className="text-xs">Right</Label>
                <Input
                  type="number"
                  placeholder="209"
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
                  placeholder="526"
                  value={data.new_door.laser_top_left || ""}
                  onChange={(e) => updateField('new_door', 'laser_top_left', parseFloat(e.target.value))}
                />
              </div>
              <div>
                <Label className="text-xs">Middle</Label>
                <Input
                  type="number"
                  placeholder="518"
                  value={data.new_door.laser_top_mid || ""}
                  onChange={(e) => updateField('new_door', 'laser_top_mid', parseFloat(e.target.value))}
                />
              </div>
              <div>
                <Label className="text-xs">Right Side</Label>
                <Input
                  type="number"
                  placeholder="539"
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
                placeholder="Roller"
                value={data.new_door.type || ""}
                onChange={(e) => updateField('new_door', 'type', e.target.value)}
              />
            </div>
            <div>
              <Label>Finish</Label>
              <Input
                placeholder="Smooth"
                value={data.new_door.finish || ""}
                onChange={(e) => updateField('new_door', 'finish', e.target.value)}
              />
            </div>
            <div>
              <Label>Colour</Label>
              <Input
                placeholder="Shale grey"
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
              <Checkbox
                checked={data.existing_door.removal_required || false}
                onCheckedChange={(checked) => updateField('existing_door', 'removal_required', checked)}
              />
              <Label className="text-sm font-normal">Removal Required</Label>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Height Left Side</Label>
              <Input
                type="number"
                placeholder="2400"
                value={data.existing_door.height_left || ""}
                onChange={(e) => updateField('existing_door', 'height_left', parseFloat(e.target.value))}
              />
            </div>
            <div>
              <Label>Height Right Side</Label>
              <Input
                type="number"
                placeholder="2250"
                value={data.existing_door.height_right || ""}
                onChange={(e) => updateField('existing_door', 'height_right', parseFloat(e.target.value))}
              />
            </div>
            <div>
              <Label>Width</Label>
              <Input
                type="number"
                placeholder="4700"
                value={data.existing_door.width || ""}
                onChange={(e) => updateField('existing_door', 'width', parseFloat(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Type</Label>
              <Input
                placeholder="Roller"
                value={data.existing_door.type || ""}
                onChange={(e) => updateField('existing_door', 'type', e.target.value)}
              />
            </div>
            <div>
              <Label>Finish</Label>
              <Input
                placeholder="Smooth"
                value={data.existing_door.finish || ""}
                onChange={(e) => updateField('existing_door', 'finish', e.target.value)}
              />
            </div>
            <div>
              <Label>Colour</Label>
              <Input
                placeholder="Shale Grey"
                value={data.existing_door.colour || ""}
                onChange={(e) => updateField('existing_door', 'colour', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Additional Information</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Any additional notes or measurements..."
            value={data.additional_info || ""}
            onChange={(e) => updateAdditionalInfo(e.target.value)}
            rows={4}
          />
        </CardContent>
      </Card>
    </div>
  );
}