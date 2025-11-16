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
    <div className="space-y-6">
      <div className="flex items-center gap-3 p-4 bg-white rounded-xl border-2 border-slate-200">
        <Checkbox
          checked={data.is_islo || false}
          onCheckedChange={updateIslo}
        />
        <Label className="font-semibold text-[#000000] cursor-pointer">ISLO</Label>
      </div>

      <Card className="border-2 border-slate-200 shadow-lg rounded-2xl">
        <CardHeader className="border-b-2 border-slate-200 bg-gradient-to-r from-slate-50 to-white">
          <CardTitle className="text-xl font-bold text-[#000000] tracking-tight">New Door Measurements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 p-6">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="font-semibold text-[#000000]">Left H</Label>
              <Input
                type="number"
                value={data.new_door.height_left || ""}
                onChange={(e) => updateField('new_door', 'height_left', parseFloat(e.target.value))}
                className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
              />
            </div>
            <div>
              <Label className="font-semibold text-[#000000]">Mid H</Label>
              <Input
                type="number"
                value={data.new_door.height_mid || ""}
                onChange={(e) => updateField('new_door', 'height_mid', parseFloat(e.target.value))}
                className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
              />
            </div>
            <div>
              <Label className="font-semibold text-[#000000]">Right H</Label>
              <Input
                type="number"
                value={data.new_door.height_right || ""}
                onChange={(e) => updateField('new_door', 'height_right', parseFloat(e.target.value))}
                className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="font-semibold text-[#000000]">Top W</Label>
              <Input
                type="number"
                value={data.new_door.width_top || ""}
                onChange={(e) => updateField('new_door', 'width_top', parseFloat(e.target.value))}
                className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
              />
            </div>
            <div>
              <Label className="font-semibold text-[#000000]">Mid W</Label>
              <Input
                type="number"
                value={data.new_door.width_mid || ""}
                onChange={(e) => updateField('new_door', 'width_mid', parseFloat(e.target.value))}
                className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
              />
            </div>
            <div>
              <Label className="font-semibold text-[#000000]">Bottom W</Label>
              <Input
                type="number"
                value={data.new_door.width_bottom || ""}
                onChange={(e) => updateField('new_door', 'width_bottom', parseFloat(e.target.value))}
                className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="font-semibold text-[#000000]">Left Sideroom</Label>
              <Input
                type="number"
                value={data.new_door.sideroom_left || ""}
                onChange={(e) => updateField('new_door', 'sideroom_left', parseFloat(e.target.value))}
                className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
              />
            </div>
            <div>
              <Label className="font-semibold text-[#000000]">Right Sideroom</Label>
              <Input
                type="number"
                value={data.new_door.sideroom_right || ""}
                onChange={(e) => updateField('new_door', 'sideroom_right', parseFloat(e.target.value))}
                className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
              />
            </div>
            <div>
              <Label className="font-semibold text-[#000000]">Headroom</Label>
              <Input
                type="number"
                value={data.new_door.headroom || ""}
                onChange={(e) => updateField('new_door', 'headroom', parseFloat(e.target.value))}
                className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
              />
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t-2 border-slate-200">
            <Label className="text-base font-bold text-[#000000]">Laser Floor</Label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium">Left Side</Label>
                <Input
                  type="number"
                  value={data.new_door.laser_floor_left || ""}
                  onChange={(e) => updateField('new_door', 'laser_floor_left', parseFloat(e.target.value))}
                  className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Middle</Label>
                <Input
                  type="number"
                  value={data.new_door.laser_floor_mid || ""}
                  onChange={(e) => updateField('new_door', 'laser_floor_mid', parseFloat(e.target.value))}
                  className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Right Side</Label>
                <Input
                  type="number"
                  value={data.new_door.laser_floor_right || ""}
                  onChange={(e) => updateField('new_door', 'laser_floor_right', parseFloat(e.target.value))}
                  className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t-2 border-slate-200">
            <Label className="text-base font-bold text-[#000000]">Laser Top</Label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium">Left Side</Label>
                <Input
                  type="number"
                  value={data.new_door.laser_top_left || ""}
                  onChange={(e) => updateField('new_door', 'laser_top_left', parseFloat(e.target.value))}
                  className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Middle</Label>
                <Input
                  type="number"
                  value={data.new_door.laser_top_mid || ""}
                  onChange={(e) => updateField('new_door', 'laser_top_mid', parseFloat(e.target.value))}
                  className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Right Side</Label>
                <Input
                  type="number"
                  value={data.new_door.laser_top_right || ""}
                  onChange={(e) => updateField('new_door', 'laser_top_right', parseFloat(e.target.value))}
                  className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-3 border-t-2 border-slate-200">
            <div>
              <Label className="font-semibold text-[#000000]">Type</Label>
              <Input
                value={data.new_door.type || ""}
                onChange={(e) => updateField('new_door', 'type', e.target.value)}
                className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
              />
            </div>
            <div>
              <Label className="font-semibold text-[#000000]">Finish</Label>
              <Input
                value={data.new_door.finish || ""}
                onChange={(e) => updateField('new_door', 'finish', e.target.value)}
                className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
              />
            </div>
            <div>
              <Label className="font-semibold text-[#000000]">Colour</Label>
              <Input
                value={data.new_door.colour || ""}
                onChange={(e) => updateField('new_door', 'colour', e.target.value)}
                className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-slate-200 shadow-lg rounded-2xl">
        <CardHeader className="border-b-2 border-slate-200 bg-gradient-to-r from-slate-50 to-white">
          <CardTitle className="text-xl font-bold text-[#000000] tracking-tight flex items-center justify-between">
            <span>Existing Door</span>
            <div className="flex items-center gap-3">
              <Checkbox
                checked={data.existing_door.removal_required || false}
                onCheckedChange={(checked) => updateField('existing_door', 'removal_required', checked)}
              />
              <Label className="text-sm font-semibold cursor-pointer">Removal Required</Label>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 p-6">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="font-semibold text-[#000000]">Height Left Side</Label>
              <Input
                type="number"
                value={data.existing_door.height_left || ""}
                onChange={(e) => updateField('existing_door', 'height_left', parseFloat(e.target.value))}
                className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
              />
            </div>
            <div>
              <Label className="font-semibold text-[#000000]">Height Right Side</Label>
              <Input
                type="number"
                value={data.existing_door.height_right || ""}
                onChange={(e) => updateField('existing_door', 'height_right', parseFloat(e.target.value))}
                className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
              />
            </div>
            <div>
              <Label className="font-semibold text-[#000000]">Width</Label>
              <Input
                type="number"
                value={data.existing_door.width || ""}
                onChange={(e) => updateField('existing_door', 'width', parseFloat(e.target.value))}
                className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="font-semibold text-[#000000]">Type</Label>
              <Input
                value={data.existing_door.type || ""}
                onChange={(e) => updateField('existing_door', 'type', e.target.value)}
                className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
              />
            </div>
            <div>
              <Label className="font-semibold text-[#000000]">Finish</Label>
              <Input
                value={data.existing_door.finish || ""}
                onChange={(e) => updateField('existing_door', 'finish', e.target.value)}
                className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
              />
            </div>
            <div>
              <Label className="font-semibold text-[#000000]">Colour</Label>
              <Input
                value={data.existing_door.colour || ""}
                onChange={(e) => updateField('existing_door', 'colour', e.target.value)}
                className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-slate-200 shadow-lg rounded-2xl">
        <CardHeader className="border-b-2 border-slate-200 bg-gradient-to-r from-slate-50 to-white">
          <CardTitle className="text-xl font-bold text-[#000000] tracking-tight">Additional Information</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <Textarea
            value={data.additional_info || ""}
            onChange={(e) => updateAdditionalInfo(e.target.value)}
            rows={4}
            className="border-2 border-slate-300 focus:border-[#fae008] focus:ring-2 focus:ring-[#fae008]/20 transition-all"
          />
        </CardContent>
      </Card>
    </div>
  );
}