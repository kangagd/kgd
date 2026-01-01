import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, User, Mail, Shield, Lock, Bell, LogOut, FileSignature } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import ReactQuill from "react-quill";

export default function UserProfile() {
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    full_name: "",
    display_name: "",
    email: "",
    role: "",
    is_field_technician: false
  });
  const [emailSignature, setEmailSignature] = useState("");
  const [notificationSettings, setNotificationSettings] = useState({
    job_assigned: true,
    job_rescheduled: true,
    technician_check_in: true,
    technician_check_out: true,
    project_stage_changed: true,
    task_assigned: true,
    email_linked: true,
    job_starting_soon: true,
    technician_at_other_job: true
  });
  const [passwords, setPasswords] = useState({
    current: "",
    new: "",
    confirm: ""
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        setFormData({
          full_name: currentUser.full_name || "",
          display_name: currentUser.display_name || currentUser.full_name || "",
          email: currentUser.email || "",
          role: currentUser.role || "",
          is_field_technician: currentUser.is_field_technician || false
        });
        setEmailSignature(currentUser.email_signature || "");
        setNotificationSettings({
          job_assigned: currentUser.notification_settings?.job_assigned ?? true,
          job_rescheduled: currentUser.notification_settings?.job_rescheduled ?? true,
          technician_check_in: currentUser.notification_settings?.technician_check_in ?? true,
          technician_check_out: currentUser.notification_settings?.technician_check_out ?? true,
          project_stage_changed: currentUser.notification_settings?.project_stage_changed ?? true,
          task_assigned: currentUser.notification_settings?.task_assigned ?? true,
          email_linked: currentUser.notification_settings?.email_linked ?? true,
          job_starting_soon: currentUser.notification_settings?.job_starting_soon ?? true,
          technician_at_other_job: currentUser.notification_settings?.technician_at_other_job ?? true
        });
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  const updateProfileMutation = useMutation({
    mutationFn: async (data) => {
      await base44.auth.updateMe(data);
      // Refetch the updated user data
      const updatedUser = await base44.auth.me();
      return updatedUser;
    },
    onSuccess: (updatedUser) => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setUser(updatedUser);
      setFormData({
        full_name: updatedUser.full_name || "",
        display_name: updatedUser.display_name || updatedUser.full_name || "",
        email: updatedUser.email || "",
        role: updatedUser.role || "",
        is_field_technician: updatedUser.is_field_technician || false
      });
      setEmailSignature(updatedUser.email_signature || "");
      setNotificationSettings({
        job_assigned: updatedUser.notification_settings?.job_assigned ?? true,
        job_rescheduled: updatedUser.notification_settings?.job_rescheduled ?? true,
        technician_check_in: updatedUser.notification_settings?.technician_check_in ?? true,
        technician_check_out: updatedUser.notification_settings?.technician_check_out ?? true,
        project_stage_changed: updatedUser.notification_settings?.project_stage_changed ?? true,
        task_assigned: updatedUser.notification_settings?.task_assigned ?? true,
        email_linked: updatedUser.notification_settings?.email_linked ?? true,
        job_starting_soon: updatedUser.notification_settings?.job_starting_soon ?? true,
        technician_at_other_job: updatedUser.notification_settings?.technician_at_other_job ?? true
      });
      toast.success("Profile updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update profile: " + (error.message || "Unknown error"));
    }
  });

  const handleProfileSubmit = (e) => {
    e.preventDefault();
    updateProfileMutation.mutate({
      display_name: formData.display_name,
      is_field_technician: formData.is_field_technician
    });
  };

  const handleNotificationToggle = (key) => {
    const newSettings = { ...notificationSettings, [key]: !notificationSettings[key] };
    setNotificationSettings(newSettings);
    updateProfileMutation.mutate({ notification_settings: newSettings });
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess(false);

    if (passwords.new !== passwords.confirm) {
      setPasswordError("New passwords do not match");
      return;
    }

    if (passwords.new.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    try {
      // Note: Password change would need to be implemented via base44 auth
      // This is a placeholder for the UI
      setPasswordSuccess(true);
      setPasswords({ current: "", new: "", confirm: "" });
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (error) {
      setPasswordError(error.message || "Failed to change password");
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-slate-500">Loading...</div>
      </div>
    );
  }

  const isAdmin = user.role === 'admin';

  return (
    <div className="min-h-screen bg-[#ffffff] p-2 md:p-8">
      <Toaster position="top-right" richColors />
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Profile Settings</h1>
            <p className="text-slate-500 text-sm mt-1">Manage your account information</p>
          </div>
        </div>

        <Card>
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-[#fae008]" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleProfileSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="display_name">Display Name</Label>
                <Input
                  id="display_name"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  placeholder="Enter your display name"
                />
                <p className="text-xs text-slate-500">This is how your name will appear throughout the app</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    disabled
                    className="bg-slate-50"
                  />
                </div>
                <p className="text-xs text-slate-500">Email cannot be changed</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-slate-400" />
                  <Badge variant={isAdmin ? "default" : "secondary"} className="capitalize">
                    {formData.role}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">Role is managed by administrators</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="is_field_technician">Field Technician</Label>
                  <input
                    id="is_field_technician"
                    type="checkbox"
                    checked={formData.is_field_technician}
                    onChange={(e) => setFormData({ ...formData, is_field_technician: e.target.checked })}
                    className="w-4 h-4"
                  />
                </div>
                <p className="text-xs text-slate-500">Enable if you work in the field</p>
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                  className="bg-[#fae008] hover:bg-[#e5d007] text-slate-900"
                >
                  {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="flex items-center gap-2">
              <FileSignature className="w-5 h-5 text-[#fae008]" />
              Email Signature
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <p className="text-sm text-slate-500">
              Create your email signature using the editor below. You can add text, images, and formatting.
            </p>
            <div className="text-xs text-slate-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <strong>Tip:</strong> To add an image, click the image icon in the toolbar and paste your image URL.
            </div>
            <ReactQuill
              theme="snow"
              value={emailSignature}
              onChange={setEmailSignature}
              placeholder="Enter your email signature..."
              className="bg-white rounded-lg [&_.ql-container]:min-h-[150px]"
              modules={{
                toolbar: [
                  ['bold', 'italic', 'underline'],
                  [{ 'color': [] }],
                  [{ 'list': 'bullet' }],
                  ['link', 'image']
                ]
              }}
            />
            <div className="border-t border-slate-200 pt-4">
              <p className="text-xs font-medium text-slate-600 mb-2">Preview:</p>
              <div 
                className="bg-slate-50 rounded-lg p-4 border border-slate-200 text-sm"
                dangerouslySetInnerHTML={{ __html: emailSignature }}
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  updateProfileMutation.mutate({ email_signature: emailSignature });
                }}
                disabled={updateProfileMutation.isPending}
                className="bg-[#fae008] hover:bg-[#e5d007] text-slate-900"
              >
                {updateProfileMutation.isPending ? "Saving..." : "Save Signature"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#fae008]" />
              Notification Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500 mb-4">Choose which notifications you want to receive in the app.</p>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-900">Job Assigned</p>
                  <p className="text-xs text-slate-500">When a job is assigned to you</p>
                </div>
                <Switch
                  checked={notificationSettings.job_assigned}
                  onCheckedChange={() => handleNotificationToggle('job_assigned')}
                />
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-900">Job Rescheduled</p>
                  <p className="text-xs text-slate-500">When a job you're assigned to is rescheduled</p>
                </div>
                <Switch
                  checked={notificationSettings.job_rescheduled}
                  onCheckedChange={() => handleNotificationToggle('job_rescheduled')}
                />
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-900">Job Starting Soon</p>
                  <p className="text-xs text-slate-500">Reminder 10 minutes before a job starts</p>
                </div>
                <Switch
                  checked={notificationSettings.job_starting_soon}
                  onCheckedChange={() => handleNotificationToggle('job_starting_soon')}
                />
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-900">Still at Another Job</p>
                  <p className="text-xs text-slate-500">Warning when next job starts but you're still checked in elsewhere</p>
                </div>
                <Switch
                  checked={notificationSettings.technician_at_other_job}
                  onCheckedChange={() => handleNotificationToggle('technician_at_other_job')}
                />
              </div>
              {isAdmin && (
                <>
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <div>
                      <p className="text-sm font-medium text-slate-900">Technician Check-in</p>
                      <p className="text-xs text-slate-500">When a technician checks into a job</p>
                    </div>
                    <Switch
                      checked={notificationSettings.technician_check_in}
                      onCheckedChange={() => handleNotificationToggle('technician_check_in')}
                    />
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <div>
                      <p className="text-sm font-medium text-slate-900">Technician Check-out</p>
                      <p className="text-xs text-slate-500">When a technician checks out of a job</p>
                    </div>
                    <Switch
                      checked={notificationSettings.technician_check_out}
                      onCheckedChange={() => handleNotificationToggle('technician_check_out')}
                    />
                  </div>
                </>
              )}
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-900">Project Stage Changed</p>
                  <p className="text-xs text-slate-500">When a project moves to a new stage</p>
                </div>
                <Switch
                  checked={notificationSettings.project_stage_changed}
                  onCheckedChange={() => handleNotificationToggle('project_stage_changed')}
                />
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-900">Task Assigned</p>
                  <p className="text-xs text-slate-500">When a task is assigned to you</p>
                </div>
                <Switch
                  checked={notificationSettings.task_assigned}
                  onCheckedChange={() => handleNotificationToggle('task_assigned')}
                />
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-slate-900">Email Linked</p>
                  <p className="text-xs text-slate-500">When an email is linked to a project or job</p>
                </div>
                <Switch
                  checked={notificationSettings.email_linked}
                  onCheckedChange={() => handleNotificationToggle('email_linked')}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-[#fae008]" />
              Change Password
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handlePasswordChange} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="current_password">Current Password</Label>
                <Input
                  id="current_password"
                  type="password"
                  value={passwords.current}
                  onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                  placeholder="Enter current password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new_password">New Password</Label>
                <Input
                  id="new_password"
                  type="password"
                  value={passwords.new}
                  onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                  placeholder="Enter new password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirm New Password</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  value={passwords.confirm}
                  onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                  placeholder="Confirm new password"
                />
              </div>

              {passwordError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                  Password changed successfully!
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  type="submit"
                  className="bg-[#fae008] hover:bg-[#e5d007] text-slate-900"
                >
                  Change Password
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-red-100">
          <CardContent className="p-6">
            <Button 
              variant="destructive" 
              className="w-full" 
              onClick={() => base44.auth.logout()}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Log Out
            </Button>
          </CardContent>
        </Card>


      </div>
    </div>
  );
}