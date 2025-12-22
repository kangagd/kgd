import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import AttentionItemsPanel from "../attention/AttentionItemsPanel";

export default function ProjectAttentionZone({ project }) {
  const { data: attentionItems = [] } = useQuery({
    queryKey: ['attentionItems', 'project', project.id],
    queryFn: () => base44.entities.AttentionItem.filter({ 
      entity_type: 'project',
      entity_id: project.id,
      status: 'open'
    }),
    enabled: !!project.id
  });

  // Don't render if no attention items
  if (attentionItems.length === 0) {
    return null;
  }

  return (
    <AttentionItemsPanel
      entity_type="project"
      entity_id={project.id}
      context_ids={{
        customer_id: project.customer_id,
        project_id: project.id,
        job_id: null
      }}
    />
  );
}