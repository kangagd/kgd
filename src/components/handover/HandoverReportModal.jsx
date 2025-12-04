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

export default function HandoverReportModal({ open, onClose, project, jobs = [] }) {
  const queryClient = useQueryClient();

  const [installJobId, setInstallJobId] = useState("");
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

    // Reset job selection when reopening
    setInstallJobId("");

    if (project) {
      setClientName(project.client_name || project.contact_name || project.customer_name || "");
      setSiteAddress(project.site_address || project.address_full || project.address || "");
      if (project.warranty_summary) {
        setWarrantySummary(project.warranty_summary);
      }
    }

    // Try to auto-select an installation job:
    if (jobs && jobs.length > 0) {
      const installCandidates = jobs.filter((j) => {
        const type = (j.job_type || j.type || j.job_type_name || "").toLowerCase();
        return type.includes("install");
      });
      const sorted = (installCandidates.length ? installCandidates : jobs).slice().sort((a, b) => {
        const da = new Date(a.completed_at || a.scheduled_date || 0).getTime();
        const db = new Date(b.completed_at || b.scheduled_date || 0).getTime();
        return da - db;
      });
      const installJob = sorted[sorted.length - 1];
      
      if (installJob) {
        setInstallJobId(installJob.id);
        const dt = installJob.completed_at || installJob.scheduled_date;
        setDateOfWorks(dt ? dt.slice(0, 10) : "");
        
        if (installJob.assigned_to_name && Array.isArray(installJob.assigned_to_name)) {
          setTechnicians(installJob.assigned_to_name.join(", "));
        } else if (installJob.technician_name) {
          setTechnicians(installJob.technician_name);
        }

        const wc = installJob.completion_notes || installJob.technician_notes || installJob.description || "";
        if (wc && !workCompleted) {
          setWorkCompleted(wc);
        }
        
        if (installJob.installed_products_summary) {
          setInstalledProducts(installJob.installed_products_summary);
        }
      }
    }
  }, [open, project, jobs]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!project?.id) return;

      const payload = {
        project_id: project.id,
        job_id: installJobId || null, // treat as install_job_id in usage
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
        approved_by: approved ? ((await base44.auth.me())?.email || "Office") : null,
        approved_at: approved ? new Date().toISOString() : null,
        data_snapshot: JSON.stringify({
          project_id: project.id,
          install_job_id: installJobId || null,
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

      try {
        const pdfUrl = await generateHandoverReportPdf(created);
        if (pdfUrl) {
          await base44.entities.HandoverReport.update(created.id, {
            pdf_url: pdfUrl,
          });
        }
      } catch (e) {
        console.error("Failed to generate handover PDF", e);
      }

      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["handover-reports", project?.id]);
      toast.success("Handover report saved");
      onClose && onClose();
    },
    onError: (error) => {
      toast.error("Failed to save report: " + error.message);
    }
  });

  const SectionLabel = ({ children }) => (
    <div className="mt-4 mb-1 text-[11px] font-semibold text-gray-700 uppercase tracking-wide">
      {children}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Generate Handover Report</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto pr-2 p-1">
          {/* Basics */}
          <SectionLabel>Job & Client Details</SectionLabel>
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
              <label className="text-xs text-gray-500 font-medium mb-1 block">Installation visit (job)</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={installJobId}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  setInstallJobId(selectedId);
                  const j = jobs.find((job) => job.id === selectedId);
                  if (j) {
                    const dt = j.completed_at || j.scheduled_date;
                    setDateOfWorks(dt ? dt.slice(0, 10) : "");
                    if (j.assigned_to_name && Array.isArray(j.assigned_to_name)) {
                      setTechnicians(j.assigned_to_name.join(", "));
                    } else if (j.technician_name) {
                      setTechnicians(j.technician_name);
                    }
                    const wc = j.completion_notes || j.technician_notes || j.description || "";
                    if (wc) {
                      setWorkCompleted(wc);
                    }
                  }
                }}
              >
                <option value="">Select installation visit (optional)</option>
                {jobs.map((j) => {
                  const labelParts = [];
                  const dt = j.completed_at || j.scheduled_date;
                  if (dt) labelParts.push(dt.slice(0, 10));
                  if (j.job_type_name || j.job_type) labelParts.push(j.job_type_name || j.job_type);
                  if (j.job_number) labelParts.push(`#${j.job_number}`);
                  const label = labelParts.join(" – ");
                  return (
                    <option key={j.id} value={j.id}>
                      {label || j.id}
                    </option>
                  );
                })}
              </select>
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

          {/* What we tell the client */}
          <SectionLabel>What we tell the client</SectionLabel>

          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">What we did today</label>
            <Textarea
              rows={4}
              placeholder="- Checked and tested both doors&#10;- Adjusted spring tension&#10;- Tightened fixings and added support"
              value={workCompleted}
              onChange={(e) => setWorkCompleted(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">What we found (if anything)</label>
            <Textarea
              rows={3}
              placeholder="E.g. No product faults found. Existing structure for the motor is incomplete, causing movement at the head/track fixings."
              value={causeIdentified}
              onChange={(e) => setCauseIdentified(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">What happens next</label>
            <Textarea
              rows={3}
              placeholder="- Builder to complete noggin/structure at marked locations&#10;- KangarooGD to return to install motors and safety beams&#10;- Recommend annual service to keep everything running smoothly"
              value={recommendations}
              onChange={(e) => setRecommendations(e.target.value)}
            />
          </div>

          {/* Products & care */}
          <SectionLabel>Products & care</SectionLabel>

          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">Installed products (for summary)</label>
            <Textarea
              rows={3}
              placeholder="E.g. 2x Custom GlassLite sectional doors (low headroom)&#10;2x Merlin Commander Platinum motors (to be installed on return)"
              value={installedProducts}
              onChange={(e) => setInstalledProducts(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">How to look after your door</label>
            <Textarea
              rows={3}
              placeholder="- Book a service roughly every 12 months&#10;- Keep the area under the door clear before operating&#10;- Contact us if the door feels heavy, noisy or jerky"
              value={warrantySummary}
              onChange={(e) => setWarrantySummary(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 font-medium mb-1 block">Manuals & links (one per line)</label>
            <Textarea
              rows={2}
              placeholder="- Merlin Commander Platinum – User Manual&#10;- Custom Sectional Door – Care & Maintenance Guide&#10;- KangarooGD – Full Warranty Terms"
              value={manuals}
              onChange={(e) => setManuals(e.target.value)}
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