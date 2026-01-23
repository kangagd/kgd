import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { X, Mail, Phone, ExternalLink, MessageCircle, TrendingUp, DollarSign, Calendar } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TEMP_BUCKETS } from "./leadViewModel";
import { createFollowUpTask } from "./createFollowUpTask";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

const formatCurrency = (value) => {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDaysSince = (days) => {
  if (days === null || days === undefined) return "—";
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat("en-AU", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  } catch {
    return "—";
  }
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return "—";
  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat("en-AU", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "—";
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function LeadSidePanel({ open, onOpenChange, lead, project, threads = [], quotes = [] }) {
  const navigate = useNavigate();
  const [creatingTask, setCreatingTask] = React.useState(false);
  const [taskCreated, setTaskCreated] = React.useState(false);

  // Reset task creation state when panel opens with new lead
  React.useEffect(() => {
    if (open && lead) {
      setCreatingTask(false);
      setTaskCreated(false);
    }
  }, [open, lead?.project_id]);

  // Guard: null lead
  if (!lead) {
    return null;
  }

  // Handlers
  const handleOpenProject = () => {
    navigate(createPageUrl("Projects") + `?projectId=${lead.project_id}`);
    onOpenChange(false);
  };

  const handleOpenInbox = (threadId) => {
    navigate(createPageUrl("Inbox") + `?threadId=${threadId}`);
    onOpenChange(false);
  };

  const handleCreateTask = async () => {
    if (creatingTask || taskCreated) return;

    setCreatingTask(true);

    try {
      const nowIso = new Date().toISOString();
      await createFollowUpTask({
        lead,
        project,
        threadsForProject: threads,
        base44,
        nowIso,
      });

      toast.success("Follow-up task created");
      setTaskCreated(true);
    } catch (error) {
      console.error("Error creating task:", error);
      toast.error("Could not create task — please try again");
    } finally {
      setCreatingTask(false);
    }
  };

  // Sort threads by last message (most recent first)
  const sortedThreads = [...threads]
    .filter((t) => t && !t.deleted_at && !t.is_deleted)
    .sort((a, b) => {
      const aTime = a.last_message_date || a.lastMessageDate || a.last_message_at || a.updated_at || "";
      const bTime = b.last_message_date || b.lastMessageDate || b.last_message_at || b.updated_at || "";
      return bTime.localeCompare(aTime);
    })
    .slice(0, 5);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[540px] overflow-y-auto">
        {/* Header */}
        <SheetHeader className="space-y-3 pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <SheetTitle className="text-2xl">{lead.customer_name || "Unknown Customer"}</SheetTitle>
              <div className="text-sm text-muted-foreground mt-1">
                {lead.address_suburb && <span>{lead.address_suburb} • </span>}
                <span>Project #{lead.project_number || "—"}</span>
              </div>
            </div>
          </div>

          {/* Stage + Temp badges */}
          <div className="flex gap-2">
            <Badge variant="outline" className="capitalize">
              {lead.lead_stage?.replace(/_/g, " ") || "—"}
            </Badge>
            <Badge
              variant={
                lead.temperature_bucket === TEMP_BUCKETS.HOT
                  ? "destructive"
                  : lead.temperature_bucket === TEMP_BUCKETS.WARM
                  ? "default"
                  : "secondary"
              }
              className="capitalize"
            >
              {lead.temperature_bucket || "—"}
            </Badge>
          </div>
        </SheetHeader>

        <Separator className="my-4" />

        {/* Summary Card */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="w-4 h-4" />
                Quote Value
              </div>
              <span className="font-semibold">{formatCurrency(lead.primary_quote_value)}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="w-4 h-4" />
                Temperature Score
              </div>
              <span className="font-semibold">{lead.temperature_score || 0}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                Last Customer Activity
              </div>
              <span className="font-medium">{formatDaysSince(lead.days_since_customer)}</span>
            </div>

            {lead.next_action && (
              <>
                <Separator className="my-2" />
                <div>
                  <div className="text-sm font-medium mb-1">Recommended Action</div>
                  <div className="text-sm capitalize font-semibold text-primary">
                    {lead.next_action.replace(/_/g, " ")}
                  </div>
                  {lead.next_action_reason && (
                    <div className="text-xs text-muted-foreground mt-1">{lead.next_action_reason}</div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Customer Contact Card */}
        {(lead.customer_email || lead.customer_phone) && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-base">Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {lead.customer_email && (
                <a
                  href={`mailto:${lead.customer_email}`}
                  className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  {lead.customer_email}
                </a>
              )}
              {lead.customer_phone && (
                <a
                  href={`tel:${lead.customer_phone}`}
                  className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  {lead.customer_phone}
                </a>
              )}
            </CardContent>
          </Card>
        )}

        {/* Quote Card */}
        {lead.primary_quote_id && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-base">Quote</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant="outline" className="capitalize">
                  {lead.primary_quote_status?.replace(/_/g, " ") || "—"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Value</span>
                <span className="font-semibold">{formatCurrency(lead.primary_quote_value)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Created</span>
                <span className="text-sm">{formatDate(lead.primary_quote_created_at)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Messages */}
        {sortedThreads.length > 0 && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-base">Recent Messages</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {sortedThreads.map((thread) => {
                const lastMessageAt =
                  thread.last_message_date || thread.lastMessageDate || thread.last_message_at || thread.updated_at;
                const isUnread = thread.isUnread || thread.is_unread || thread.unread;
                const snippet = thread.snippet || thread.last_message_snippet || "";

                return (
                  <div
                    key={thread.id}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => handleOpenInbox(thread.id)}
                  >
                    {isUnread && <div className="w-2 h-2 rounded-full bg-blue-600 mt-2 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs text-muted-foreground">{formatDateTime(lastMessageAt)}</span>
                        {lead.last_touch_direction && (
                          <Badge variant="outline" className="text-xs capitalize">
                            {lead.last_touch_direction}
                          </Badge>
                        )}
                      </div>
                      {snippet && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{snippet}</p>
                      )}
                    </div>
                    <MessageCircle className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Footer Actions */}
        <div className="flex flex-col gap-2 pt-4 border-t sticky bottom-0 bg-background pb-4">
          <Button onClick={handleCreateTask} disabled={creatingTask || taskCreated}>
            {creatingTask ? "Creating..." : taskCreated ? "Task Created" : "Create Follow-up Task"}
          </Button>
          <div className="flex gap-2">
            <Button onClick={handleOpenProject} variant="outline" className="flex-1">
              <ExternalLink className="w-4 h-4 mr-2" />
              Open Project
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}