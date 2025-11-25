import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar, Clock, Plus, Trash2, Edit, User, Timer, Check, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import MultiTechnicianSelect from "./MultiTechnicianSelect";

const visitStatusColors = {
  scheduled: "bg-blue-100 text-blue-700 border-blue-200",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-100 text-red-700 border-red-200"
};

export default function ScheduledVisitsManager({ 
  visits = [], 
  technicians = [],
  onVisitsChange,
  primaryDate,
  primaryTime,
  primaryDuration,
  primaryAssignedTo,
  primaryAssignedToName
}) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingVisit, setEditingVisit] = useState(null);
  const [formData, setFormData] = useState({
    date: "",
    time: "",
    duration: "",
    assigned_to: [],
    assigned_to_name: [],
    notes: "",
    status: "scheduled"
  });

  // Combine primary visit with additional visits for display
  const allVisits = [];
  
  // Add primary visit if it exists
  if (primaryDate) {
    allVisits.push({
      id: "primary",
      date: primaryDate,
      time: primaryTime || "",
      duration: primaryDuration || null,
      assigned_to: primaryAssignedTo || [],
      assigned_to_name: primaryAssignedToName || [],
      notes: "",
      status: "scheduled",
      isPrimary: true
    });
  }
  
  // Add additional visits
  if (visits && visits.length > 0) {
    allVisits.push(...visits.map(v => ({ ...v, isPrimary: false })));
  }

  // Sort by date
  allVisits.sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });

  const handleOpenAdd = () => {
    setFormData({
      date: "",
      time: "",
      duration: "",
      assigned_to: primaryAssignedTo || [],
      assigned_to_name: primaryAssignedToName || [],
      notes: "",
      status: "scheduled"
    });
    setEditingVisit(null);
    setShowAddDialog(true);
  };

  const handleOpenEdit = (visit) => {
    if (visit.isPrimary) return; // Can't edit primary through this dialog
    setFormData({
      date: visit.date || "",
      time: visit.time || "",
      duration: visit.duration || "",
      assigned_to: visit.assigned_to || [],
      assigned_to_name: visit.assigned_to_name || [],
      notes: visit.notes || "",
      status: visit.status || "scheduled"
    });
    setEditingVisit(visit);
    setShowAddDialog(true);
  };

  const handleTechnicianChange = (emails) => {
    const emailsArray = Array.isArray(emails) ? emails : [];
    const techNames = emailsArray.map(email => {
      const tech = technicians.find(t => t.email === email);
      return tech?.full_name || "";
    }).filter(Boolean);
    setFormData({
      ...formData,
      assigned_to: emailsArray,
      assigned_to_name: techNames
    });
  };

  const handleSave = () => {
    const newVisit = {
      id: editingVisit?.id || `visit-${Date.now()}`,
      date: formData.date,
      time: formData.time,
      duration: formData.duration ? parseFloat(formData.duration) : null,
      assigned_to: formData.assigned_to,
      assigned_to_name: formData.assigned_to_name,
      notes: formData.notes,
      status: formData.status
    };

    let updatedVisits;
    if (editingVisit) {
      updatedVisits = visits.map(v => v.id === editingVisit.id ? newVisit : v);
    } else {
      updatedVisits = [...(visits || []), newVisit];
    }

    onVisitsChange(updatedVisits);
    setShowAddDialog(false);
    setEditingVisit(null);
  };

  const handleDelete = (visitId) => {
    const updatedVisits = visits.filter(v => v.id !== visitId);
    onVisitsChange(updatedVisits);
  };

  const handleStatusChange = (visitId, newStatus) => {
    const updatedVisits = visits.map(v => 
      v.id === visitId ? { ...v, status: newStatus } : v
    );
    onVisitsChange(updatedVisits);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[14px] font-semibold text-[#111827] leading-[1.4]">
          Scheduled Visits ({allVisits.length})
        </h4>
        <Button
          variant="outline"
          size="sm"
          onClick={handleOpenAdd}
          className="h-8 text-xs font-medium"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add Visit
        </Button>
      </div>

      {allVisits.length === 0 ? (
        <div className="text-center py-6 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]">
          <Calendar className="w-8 h-8 text-[#9CA3AF] mx-auto mb-2" />
          <p className="text-sm text-[#6B7280]">No visits scheduled</p>
        </div>
      ) : (
        <div className="space-y-2">
          {allVisits.map((visit, index) => (
            <Card
              key={visit.id}
              className={`p-3 border ${visit.isPrimary ? 'border-[#FAE008] bg-[#FFFEF5]' : 'border-[#E5E7EB]'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="text-xs font-semibold text-[#6B7280]">
                      Visit {index + 1}
                    </span>
                    {visit.isPrimary && (
                      <Badge className="bg-[#FAE008] text-[#111827] border-0 text-[10px] px-1.5 py-0">
                        Primary
                      </Badge>
                    )}
                    <Badge className={`${visitStatusColors[visit.status]} border text-[10px] px-1.5 py-0`}>
                      {visit.status}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-3 text-sm text-[#111827]">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-[#6B7280]" />
                      <span className="font-medium">
                        {visit.date ? format(parseISO(visit.date), 'MMM d, yyyy') : 'No date'}
                      </span>
                    </div>
                    {visit.time && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-[#6B7280]" />
                        <span>{visit.time}</span>
                      </div>
                    )}
                    {visit.duration && (
                      <div className="flex items-center gap-1">
                        <Timer className="w-3.5 h-3.5 text-[#6B7280]" />
                        <span>{visit.duration}h</span>
                      </div>
                    )}
                  </div>

                  {visit.assigned_to_name && visit.assigned_to_name.length > 0 && (
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-[#6B7280]">
                      <User className="w-3 h-3" />
                      <span>{visit.assigned_to_name.join(', ')}</span>
                    </div>
                  )}

                  {visit.notes && (
                    <p className="text-xs text-[#6B7280] mt-1.5 line-clamp-1">{visit.notes}</p>
                  )}
                </div>

                {!visit.isPrimary && (
                  <div className="flex items-center gap-1">
                    {visit.status === 'scheduled' && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleStatusChange(visit.id, 'completed')}
                          className="h-7 w-7 text-emerald-600 hover:bg-emerald-50"
                          title="Mark Completed"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleStatusChange(visit.id, 'cancelled')}
                          className="h-7 w-7 text-red-600 hover:bg-red-50"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenEdit(visit)}
                      className="h-7 w-7 text-[#6B7280] hover:text-[#111827]"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(visit.id)}
                      className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingVisit ? 'Edit Visit' : 'Add New Visit'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Date *</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Time</Label>
                <Input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Duration (hours)</Label>
              <Input
                type="number"
                step="0.5"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                placeholder="e.g., 2"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Assigned Technicians</Label>
              <MultiTechnicianSelect
                selectedEmails={formData.assigned_to}
                technicians={technicians}
                onChange={handleTechnicianChange}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Notes</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Visit notes..."
              />
            </div>

            {editingVisit && (
              <div className="space-y-1.5">
                <Label className="text-sm">Status</Label>
                <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={!formData.date}
              className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
            >
              {editingVisit ? 'Save Changes' : 'Add Visit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}