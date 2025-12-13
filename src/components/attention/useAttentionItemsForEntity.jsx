import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/**
 * Fetch attention items for an entity with inheritance
 * 
 * Returns items sorted by: severity (critical > important > info), then newest first
 * Adds computed fields: inherited_from, home_entity_type, home_entity_id
 */
export function useAttentionItemsForEntity({ 
  entityType, 
  entityId, 
  projectId = null, 
  customerId = null 
}) {
  // Fetch items for current entity
  const { data: entityItems = [] } = useQuery({
    queryKey: ['attentionItems', entityType, entityId],
    queryFn: () => base44.entities.AttentionItem.filter({ 
      entity_type: entityType, 
      entity_id: entityId, 
      status: 'active' 
    }),
    staleTime: 30000,
    refetchOnWindowFocus: false
  });

  // Fetch project items (if job)
  const { data: projectItems = [] } = useQuery({
    queryKey: ['attentionItems', 'project', projectId],
    queryFn: () => base44.entities.AttentionItem.filter({ 
      entity_type: 'project', 
      entity_id: projectId, 
      status: 'active' 
    }),
    enabled: entityType === 'job' && !!projectId,
    staleTime: 30000,
    refetchOnWindowFocus: false
  });

  // Fetch customer items (if project or job)
  const { data: customerItems = [] } = useQuery({
    queryKey: ['attentionItems', 'customer', customerId],
    queryFn: () => base44.entities.AttentionItem.filter({ 
      entity_type: 'customer', 
      entity_id: customerId, 
      status: 'active' 
    }),
    enabled: (entityType === 'project' || entityType === 'job') && !!customerId,
    staleTime: 30000,
    refetchOnWindowFocus: false
  });

  // Combine and annotate items
  const allItems = [
    ...entityItems.map(item => ({
      ...item,
      inherited_from: null,
      home_entity_type: item.entity_type,
      home_entity_id: item.entity_id
    })),
    ...projectItems.map(item => ({
      ...item,
      inherited_from: 'project',
      home_entity_type: item.entity_type,
      home_entity_id: item.entity_id
    })),
    ...customerItems.map(item => ({
      ...item,
      inherited_from: entityType === 'project' ? 'customer' : (entityType === 'job' ? 'customer' : null),
      home_entity_type: item.entity_type,
      home_entity_id: item.entity_id
    }))
  ];

  // Sort: severity (critical > important > info), then newest first
  const severityOrder = { critical: 0, important: 1, info: 2 };
  
  const sorted = allItems.sort((a, b) => {
    // First by severity
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    
    // Then by date (newest first)
    const dateA = new Date(a.created_date || a.created_at || 0);
    const dateB = new Date(b.created_date || b.created_at || 0);
    return dateB - dateA;
  });

  return sorted;
}