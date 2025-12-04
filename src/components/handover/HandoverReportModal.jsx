import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { generateHandoverReportPdf } from "@/components/handover/handoverApi";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function HandoverReportModal({ open, onClose, job, project }) {
  const queryClient = useQueryClient();

  const [clientName, setClientName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [dateOfWorks, setDateOfWorks] = useState("");
  const [technicians, setTechnicians] = useState("");
  const [workCompleted, setWorkCompleted] = useState("");
  const [causeIdentified, setCauseIdentified] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [installedProducts, setInstalledProducts] = useState("");
  const [manuals, setManuals] = useState("");
  const [warrantySummary, setWarrantySummary] = useState("");
  const [approved, setApproved] = useState(false);

  // Pre-fill on open
  useEffect(() => {
    if (!open) return;
    if (project) {
      setClientName(project.client_name || project.contact_name || project.customer_name || "");
      setSiteAddress(project.site_address || project.address_full || project.address || "");
      setWarrantySummary(project.warranty_summary || "");
    } else if (job) {
      setClientName(job.customer_name || "");
      setSiteAddress(job.address_full || job.address || "");
    }
    
    if (job) {
      // fallback date: job.completed_at or job.scheduled_date
      const dt = job.completed_at || job.scheduled_date;
      setDateOfWorks(dt ? dt.slice(0, 10) : "");
      
      // technicians: join names if relation is resolved, else fall back to text
      if (job.assigned_to_name && Array.isArray(job.assigned_to_name)) {
        setTechnicians(job.assigned_to_name.join(", "));
      } else if (job.technician_name) {
        setTechnicians(job.technician_name);
      }

      // Pre-fill work completed from technician notes / completion notes / description
      const wc = job.completion_notes || job.technician_notes || job.description || "";
      setWorkCompleted(wc);

      // Optional: pre-fill products & manuals if the job has that data
      if (job.installed_products_summary) {
        setInstalledProducts(job.installed_products_summary);
      }
      if (job.manuals_summary) {
        setManuals(job.manuals_summary);
      }
    }
  }, [open, job, project]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!job?.id) return;

      const payload = {
        job_id: job.id,
        project_id: project?.id || job.project_id || null,
        status: approved ? "approved" : "draft",
        client_name: clientName,
        site_address: siteAddress,
        date_of_works: dateOfWorks || null,
        technicians,
        work_completed: workCompleted,
        cause_identified: causeIdentified,
        recommendations,
        installed_products: installedProducts,
        manuals: manuals,
        warranty_summary: warrantySummary,
        approved_by: approved ? (await base44.auth.me())?.email : null,
        approved_at: approved ? new Date().toISOString() : null,
        // pdf_url will be added later after PDF generation
        data_snapshot: JSON.stringify({
          client_name: clientName,
          site_address: siteAddress,
          date_of_works: dateOfWorks,
          technicians,
          work_completed: workCompleted,
          cause_identified: causeIdentified,
          recommendations,
          installed_products: installedProducts,
          manuals,
          warranty_summary: warrantySummary,
        }),
      };

      const created = await base44.entities.HandoverReport.create(payload);

      // Generate PDF (stub for now)
      try {
        const pdfUrl = await generateHandoverReportPdf(created);
        if (pdfUrl) {
          await base44.entities.HandoverReport.update(created.id, {
            pdf_url: pdfUrl,
          });
        }
      } catch (e) {
        // Fail silently for now; PDF can be regenerated later
        console.error("Failed to generate handover PDF", e);
      }

      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["handover-reports", job?.id]);
      toast.success("Handover report saved");
      onClose && onClose();
    },
    onError: (error) => {
      toast.error("Failed to save report: " + error.message);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Generate Handover Report</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto pr-2 p-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">Client</label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium mb-1 block">Date of Works</label>
              <Input
                type="date"
                value={dateOfWorks}
                onChange={(e) => setDateOfWorks(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-gray-500 font-medium mb-1 block">Site Address</label>
              <Input value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-gray-500 font-medium mb-1 block">Technicians</label>
              <Input value={technicians} onChange={(e) => setTechnicians(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">Work Completed</label>
            <Textarea
              rows={4}
              value={workCompleted}
              onChange={(e) => setWorkCompleted(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">Cause Identified (optional)</label>
            <Textarea
              rows={3}
              value={causeIdentified}
              onChange={(e) => setCauseIdentified(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">Recommendations (optional)</label>
            <Textarea
              rows={3}
              value={recommendations}
              onChange={(e) => setRecommendations(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">Installed Products (for report)</label>
            <Textarea
              rows={3}
              placeholder="e.g. 2x Custom GlassLite Sectional Doors (low headroom), 2x Merlin Commander Platinum motors..."
              value={installedProducts}
              onChange={(e) => setInstalledProducts(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">Manuals (for report)</label>
            <Textarea
              rows={2}
              placeholder="- Merlin Commander Platinum – User Manual&#10;- Custom Sectional Door – Care & Maintenance Guide"
              value={manuals}
              onChange={(e) => setManuals(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">Warranty Summary</label>
            <Textarea
              rows={3}
              placeholder="5 years on motors, 3 years on doors, 12 months on workmanship..."
              value={warrantySummary}
              onChange={(e) => setWarrantySummary(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 pt-2 border-t">
            <input
              id="handover-approved"
              type="checkbox"
              className="w-4 h-4 rounded border-gray-300 text-[#FAE008] focus:ring-[#FAE008]"
              checked={approved}
              onChange={(e) => setApproved(e.target.checked)}
            />
            <label htmlFor="handover-approved" className="text-sm text-gray-700 font-medium">
              Approved for sending to client
            </label>
          </div>
        </div>

        <DialogFooter className="flex justify-between gap-2 mt-4">
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Handover Report"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}