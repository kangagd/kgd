import { createClientFromRequest } from "npm:@base44/sdk@0.8.4";
import { jsPDF } from "npm:jspdf@2.5.1";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { project_id } = await req.json();
    if (!project_id) {
      return Response.json({ error: "project_id is required" }, { status: 400 });
    }

    const project = await base44.entities.Project.get(project_id);
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    // 🔒 Project must be completed
    if (project.status !== "Completed") {
      return Response.json(
        { error: "Handover can only be generated for completed projects" },
        { status: 400 }
      );
    }

    // 🔒 Prevent regeneration
    if (project.handover_locked && project.handover_pdf_url) {
      return Response.json(
        { error: "Handover already generated", pdf_url: project.handover_pdf_url },
        { status: 409 }
      );
    }

    // Fetch related jobs
    const jobs = await base44.entities.Job.filter({ project_id: project_id });
    const completedJobs = jobs.filter(j => j.status === "Completed");

    // Fetch parts
    const parts = await base44.entities.Part.filter({ project_id: project_id });

    // Fetch photos
    const photos = await base44.entities.Photo.filter({ project_id: project_id });

    const prompt = `
You are preparing a FINAL client handover report for a completed project.

IMPORTANT RULES:
- Use ONLY information already provided by technicians and the system
- Do NOT invent details
- Rewrite for clarity and professionalism
- Use bullet points
- Write for a non-technical client
- Combine overlapping information cleanly

PROJECT:
Title: ${project.title}
Type: ${project.project_type}
Address: ${project.address_full || project.address}
Customer: ${project.customer_name}

COMPLETED JOBS:
${completedJobs.map(j => `
Job: ${j.job_type_name || j.job_number}
Overview: ${j.overview || ""}
Outcome: ${j.outcome || ""}
Communication with Client: ${j.communication_with_client || ""}
Next Steps: ${j.next_steps || ""}
Additional Info: ${j.additional_info || ""}
`).join("\n")}

PARTS USED:
${parts.map(p => `- ${p.item_name || p.category} (${p.quantity_required || 1})`).join("\n")}

PHOTOS:
${photos.map(p => `- ${p.tags || ""} ${p.notes || ""}`).join("\n")}

OUTPUT FORMAT (JSON):
{
  "overview": string[],
  "work_completed": string[],
  "outcome": string[],
  "next_steps": string[],
  "client_communication_summary": string[]
}

Keep all values as BULLET POINT ARRAYS.
`;

    const ai = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          overview: { type: "array", items: { type: "string" } },
          work_completed: { type: "array", items: { type: "string" } },
          outcome: { type: "array", items: { type: "string" } },
          next_steps: { type: "array", items: { type: "string" } },
          client_communication_summary: { type: "array", items: { type: "string" } }
        },
        required: ["overview", "work_completed", "outcome", "next_steps"]
      }
    });

    // Build branded PDF with jsPDF
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('Project Handover Report', 20, 20);
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text(project.title, 20, 30);
    doc.text(`Customer: ${project.customer_name}`, 20, 37);
    doc.text(`Address: ${project.address_full || project.address || 'N/A'}`, 20, 44);
    
    // Yellow line separator
    doc.setDrawColor(250, 224, 8); // #FAE008
    doc.setLineWidth(2);
    doc.line(20, 50, 190, 50);

    let yPosition = 60;

    const addSection = (title, items) => {
      if (!items || items.length === 0) return;
      
      // Check if we need a new page
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text(title, 20, yPosition);
      yPosition += 8;

      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      
      items.forEach(item => {
        const lines = doc.splitTextToSize(`• ${item}`, 170);
        
        // Check if we need a new page
        if (yPosition + (lines.length * 6) > 280) {
          doc.addPage();
          yPosition = 20;
        }
        
        lines.forEach(line => {
          doc.text(line, 25, yPosition);
          yPosition += 6;
        });
        yPosition += 2;
      });
      
      yPosition += 5;
    };

    addSection("Project Overview", ai.overview);
    addSection("Work Completed", ai.work_completed);
    addSection("Outcome", ai.outcome);
    addSection("Next Steps", ai.next_steps);
    if (ai.client_communication_summary && ai.client_communication_summary.length > 0) {
      addSection("Client Communication Summary", ai.client_communication_summary);
    }

    // Footer
    const pageCount = doc.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128); // #6B7280
      doc.text(
        `KangarooGD · Final Project Handover · Page ${i} of ${pageCount}`,
        20,
        290
      );
    }

    // Generate PDF as ArrayBuffer
    const pdfBytes = doc.output('arraybuffer');
    
    // Upload to storage
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const file = new File([blob], `handover-${project.project_number || project_id}.pdf`, { 
      type: 'application/pdf' 
    });
    
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    // Update project with handover metadata
    await base44.asServiceRole.entities.Project.update(project_id, {
      handover_pdf_url: file_url,
      handover_generated_at: new Date().toISOString(),
      handover_generated_by: user.email,
      handover_locked: true
    });

    return Response.json({ 
      success: true, 
      pdf_url: file_url,
      generated_by: user.email,
      generated_at: new Date().toISOString()
    });

  } catch (err) {
    console.error("generateProjectHandoverReport error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});