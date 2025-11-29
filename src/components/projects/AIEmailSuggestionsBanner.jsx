import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, X, Check, ArrowRight, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function AIEmailSuggestionsBanner({ emailThreadId, project, onApplySuggestions }) {
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const fetchInsights = async () => {
      if (!emailThreadId) return;
      
      try {
        // Check if we already have insights for this thread
        const insights = await base44.entities.AIEmailInsight.filter({ 
          email_thread_id: emailThreadId,
          applied_to_project: false // Only show if not already applied
        });
        
        if (insights && insights.length > 0) {
          setInsight(insights[0]);
        }
      } catch (error) {
        console.error('Error fetching insights:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, [emailThreadId]);

  const handleApply = async () => {
    if (!insight) return;
    setApplying(true);
    
    // Filter only suggested fields that are present
    const fieldsToApply = {};
    const suggested = insight.suggested_project_fields || {};
    
    if (suggested.suggested_title && (!project.title || project.title === 'New Project')) 
      fieldsToApply.title = suggested.suggested_title;
      
    if (suggested.suggested_description && !project.description) 
      fieldsToApply.description = suggested.suggested_description;
      
    if (suggested.suggested_project_type && !project.project_type) 
      fieldsToApply.project_type = suggested.suggested_project_type;
      
    // Only apply if we have fields to update
    if (Object.keys(fieldsToApply).length > 0) {
      await onApplySuggestions(fieldsToApply, emailThreadId);
    } else {
      toast.info('No new information to apply to this project');
    }
    
    setApplying(false);
    setInsight(null); // Hide banner
  };

  const handleDismiss = async () => {
    if (insight) {
      // Mark as applied/dismissed so it doesn't show again
      try {
        await base44.entities.AIEmailInsight.update(insight.id, {
          applied_to_project: true, // effectively dismissed
          applied_at: new Date().toISOString()
        });
      } catch (e) {
        console.error('Error dismissing insight:', e);
      }
    }
    setInsight(null);
  };

  if (loading || !insight) return null;

  const suggested = insight.suggested_project_fields || {};
  const hasSuggestions = 
    (suggested.suggested_title && (!project.title || project.title === 'New Project')) ||
    (suggested.suggested_description && !project.description) ||
    (suggested.suggested_project_type && !project.project_type);

  if (!hasSuggestions) return null;

  return (
    <div className="mb-4">
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
        
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className="mt-1 p-2 bg-white rounded-full shadow-sm border border-purple-100">
              <Sparkles className="w-4 h-4 text-purple-600" />
            </div>
            
            <div>
              <h4 className="text-sm font-semibold text-purple-900 mb-1">
                AI Suggestions Found
              </h4>
              <p className="text-xs text-purple-700 mb-3">
                Based on the linked email thread, we found some details for this project.
              </p>
              
              <div className="space-y-2 mb-3">
                {suggested.suggested_title && (!project.title || project.title === 'New Project') && (
                  <div className="flex items-start gap-2 text-xs">
                    <Badge variant="outline" className="bg-white border-purple-200 text-purple-700 shrink-0">Title</Badge>
                    <span className="text-purple-800 font-medium">{suggested.suggested_title}</span>
                  </div>
                )}
                
                {suggested.suggested_project_type && !project.project_type && (
                  <div className="flex items-start gap-2 text-xs">
                    <Badge variant="outline" className="bg-white border-purple-200 text-purple-700 shrink-0">Type</Badge>
                    <span className="text-purple-800 font-medium">{suggested.suggested_project_type}</span>
                  </div>
                )}
                
                {suggested.suggested_description && !project.description && (
                  <div className="flex items-start gap-2 text-xs">
                    <Badge variant="outline" className="bg-white border-purple-200 text-purple-700 shrink-0">Desc</Badge>
                    <span className="text-purple-800 line-clamp-2">{suggested.suggested_description}</span>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={handleApply} 
                  disabled={applying}
                  className="bg-purple-600 hover:bg-purple-700 text-white border-0 h-8 text-xs"
                >
                  {applying ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                      Applying...
                    </>
                  ) : (
                    <>
                      <Check className="w-3 h-3 mr-1.5" />
                      Apply Suggestions
                    </>
                  )}
                </Button>
                
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleDismiss}
                  className="bg-white border-purple-200 text-purple-700 hover:bg-purple-50 h-8 text-xs"
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
          
          <button 
            onClick={handleDismiss}
            className="text-purple-400 hover:text-purple-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}