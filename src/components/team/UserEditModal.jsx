import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Phone, Shield, MapPin, X, Plus } from "lucide-react";

export default function UserEditModal({ user, open, onClose, onSave, isSaving }) {
  const [formData, setFormData] = useState({
    full_name: "",
    display_name: "",
    email: "",
    role: "user",
    is_field_technician: false,
    phone: "",
    status: "active",
    job_title: "",
    skills: [],
    home_address: "",
    max_jobs_per_day: 6
  });
  const [newSkill, setNewSkill] = useState("");

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || "",
        display_name: user.display_name || "",
        email: user.email || "",
        role: user.role || "user",
        is_field_technician: user.is_field_technician || false,
        phone: user.phone || "",
        status: user.status || "active",
        job_title: user.job_title || "",
        skills: user.skills || [],
        home_address: user.home_address || "",
        max_jobs_per_day: user.max_jobs_per_day || 6
      });
    }
  }, [user]);

  const addSkill = () => {
    if (newSkill.trim() && !formData.skills.includes(newSkill.trim())) {
      setFormData({ ...formData, skills: [...formData.skills, newSkill.trim()] });
      setNewSkill("");
    }
  };

  const removeSkill = (skillToRemove) => {
    setFormData({ ...formData, skills: formData.skills.filter(s => s !== skillToRemove) });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(user.id, {
      full_name: formData.full_name,
      display_name: formData.display_name,
      extended_role: formData.role,
      is_field_technician: formData.is_field_technician,
      phone: formData.phone,
      status: formData.status,
      job_title: formData.job_title,
      skills: formData.skills,
      home_address: formData.home_address,
      max_jobs_per_day: formData.max_jobs_per_day
    });
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[18px] font-semibold text-[#111827]">
            <User className="w-5 h-5 text-[#FAE008]" />
            Edit Team Member
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="Enter full name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="display_name">Display Name</Label>
            <Input
              id="display_name"
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              placeholder="e.g. John D. or JD"
            />
            <p className="text-[12px] text-[#6B7280]">Short name shown in the app (optional)</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#9CA3AF]" />
              <Input
                id="email"
                type="email"
                value={formData.email}
                disabled
                className="bg-[#F3F4F6]"
              />
            </div>
            <p className="text-[12px] text-[#6B7280]">Email cannot be changed</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="job_title">Job Title</Label>
            <Input
              id="job_title"
              value={formData.job_title}
              onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
              placeholder="e.g. Senior Technician"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-[#9CA3AF]" />
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Enter phone number"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#9CA3AF]" />
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-[12px] text-[#6B7280]">
              Admin: Full access • Manager: Full access except settings • Viewer: Read-only
            </p>
          </div>

          <div className="flex items-center justify-between py-2 px-3 bg-[#F9FAFB] rounded-lg">
            <div>
              <Label htmlFor="is_field_technician" className="text-[14px] font-medium">Field Technician</Label>
              <p className="text-[12px] text-[#6B7280]">Enable mobile technician view</p>
            </div>
            <Switch
              id="is_field_technician"
              checked={formData.is_field_technician}
              onCheckedChange={(checked) => setFormData({ ...formData, is_field_technician: checked })}
            />
          </div>

          {formData.is_field_technician && (
            <>
              <div className="space-y-2">
                <Label>Skills</Label>
                <div className="flex gap-2">
                  <Input
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    placeholder="e.g. Garage Door Install"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                  />
                  <Button type="button" variant="outline" onClick={addSkill} className="shrink-0">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {formData.skills.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.skills.map((skill) => (
                      <Badge key={skill} variant="secondary" className="flex items-center gap-1 px-2 py-1">
                        {skill}
                        <button type="button" onClick={() => removeSkill(skill)} className="ml-1 hover:text-red-500">
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-[12px] text-[#6B7280]">Skills help match technicians to jobs</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="home_address">Home Address</Label>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#9CA3AF]" />
                  <Input
                    id="home_address"
                    value={formData.home_address}
                    onChange={(e) => setFormData({ ...formData, home_address: e.target.value })}
                    placeholder="Enter home address for route optimization"
                  />
                </div>
                <p className="text-[12px] text-[#6B7280]">Used to optimize daily routes</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_jobs_per_day">Max Jobs Per Day</Label>
                <Input
                  id="max_jobs_per_day"
                  type="number"
                  min={1}
                  max={15}
                  value={formData.max_jobs_per_day}
                  onChange={(e) => setFormData({ ...formData, max_jobs_per_day: parseInt(e.target.value) || 6 })}
                />
                <p className="text-[12px] text-[#6B7280]">Maximum number of jobs this technician can handle per day</p>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSaving}
              className="bg-[#FAE008] hover:bg-[#E5CF07] text-[#111827]"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}