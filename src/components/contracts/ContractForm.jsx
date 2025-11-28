import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

export default function ContractForm({ contract, onSubmit, onCancel, isSubmitting }) {
  const [formData, setFormData] = useState(contract || {
    name: "",
    organisation_id: "",
    contract_type: "",
    start_date: "",
    end_date: "",
    sla_response_time_hours: "",
    service_coverage: "",
    billing_model: "",
    status: "Active",
    notes: ""
  });

  const { data: organisations = [] } = useQuery({
    queryKey: ['organisations'],
    queryFn: () => base44.entities.Organisation.list()
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      sla_response_time_hours: formData.sla_response_time_hours ? Number(formData.sla_response_time_hours) : null
    });
  };

  return (
    <Card className="border-2 border-slate-200 shadow-lg rounded-2xl">
      <CardHeader className="border-b-2 border-slate-200 bg-gradient-to-r from-slate-50 to-white p-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onCancel} className="hover:bg-slate-200">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <CardTitle className="text-[22px] font-semibold text-[#111827]">
            {contract ? 'Edit Contract' : 'New Contract'}
          </CardTitle>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="p-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Contract Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="e.g. Ambulance NSW - Service Contract"
              className="border-2 border-slate-300 focus:border-[#fae008]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="organisation_id">Organisation *</Label>
            <Select 
              value={formData.organisation_id} 
              onValueChange={(val) => setFormData({ ...formData, organisation_id: val })}
              required
            >
              <SelectTrigger className="border-2 border-slate-300">
                <SelectValue placeholder="Select Organisation" />
              </SelectTrigger>
              <SelectContent>
                {organisations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="contract_type">Contract Type</Label>
              <Input
                id="contract_type"
                value={formData.contract_type}
                onChange={(e) => setFormData({ ...formData, contract_type: e.target.value })}
                placeholder="e.g. Service & Repair"
                className="border-2 border-slate-300"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(val) => setFormData({ ...formData, status: val })}
              >
                <SelectTrigger className="border-2 border-slate-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="On-Hold">On-Hold</SelectItem>
                  <SelectItem value="Expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="border-2 border-slate-300"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="border-2 border-slate-300"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="sla">SLA Response Time (Hours)</Label>
              <Input
                id="sla"
                type="number"
                value={formData.sla_response_time_hours}
                onChange={(e) => setFormData({ ...formData, sla_response_time_hours: e.target.value })}
                placeholder="e.g. 4"
                className="border-2 border-slate-300"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing">Billing Model</Label>
              <Input
                id="billing"
                value={formData.billing_model}
                onChange={(e) => setFormData({ ...formData, billing_model: e.target.value })}
                placeholder="e.g. Monthly Fixed + Parts"
                className="border-2 border-slate-300"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="coverage">Service Coverage</Label>
            <Textarea
              id="coverage"
              value={formData.service_coverage}
              onChange={(e) => setFormData({ ...formData, service_coverage: e.target.value })}
              placeholder="Details about what is covered..."
              className="border-2 border-slate-300 min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="border-2 border-slate-300 min-h-[100px]"
            />
          </div>
        </CardContent>
        <CardFooter className="border-t-2 border-slate-200 flex justify-end gap-3 p-6 bg-slate-50">
          <Button type="button" variant="outline" onClick={onCancel} className="border-2 font-semibold">
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={isSubmitting} 
            className="bg-[#fae008] hover:bg-[#e5d007] text-[#000000] font-bold"
          >
            {isSubmitting ? 'Saving...' : 'Save Contract'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}