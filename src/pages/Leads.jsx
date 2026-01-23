import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { TrendingUp, Search, RefreshCw, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { computeLeadViews, groupByProjectId } from "@/components/leads/computeLeadViews";
import { LEAD_STAGES, TEMP_BUCKETS } from "@/components/leads/leadViewModel";
import LeadSidePanel from "@/components/leads/LeadSidePanel";
import { createFollowUpTask } from "@/components/leads/createFollowUpTask";
import { toast } from "sonner";

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
  if (days === 1) return "1d";
  return `${days}d`;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Leads() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [tempFilter, setTempFilter] = useState("all");
  const [selectedLead, setSelectedLead] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [creatingTaskByProjectId, setCreatingTaskByProjectId] = useState({});
  const [taskCreatedByProjectId, setTaskCreatedByProjectId] = useState({});

  const nowIso = useMemo(() => new Date().toISOString(), []);

  // Fetch Projects once
  const { data: projects = [], isLoading: projectsLoading, error: projectsError, refetch: refetchProjects } = useQuery({
    queryKey: ["projects", "leads"],
    queryFn: () => base44.entities.Project.list(),
    staleTime: 120_000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

  // Fetch Quotes once
  const { data: quotes = [], isLoading: quotesLoading, error: quotesError, refetch: refetchQuotes } = useQuery({
    queryKey: ["quotes", "leads"],
    queryFn: () => base44.entities.Quote.list(),
    staleTime: 120_000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

  // Fetch EmailThreads once
  const { data: threads = [], isLoading: threadsLoading, error: threadsError, refetch: refetchThreads } = useQuery({
    queryKey: ["emailThreads", "leads"],
    queryFn: () => base44.entities.EmailThread.list(),
    staleTime: 120_000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

  // Compute derived LeadViews
  const leadViews = useMemo(() => {
    if (!projects.length) return [];
    return computeLeadViews({
      projects,
      quotes,
      threads,
      nowIso,
    });
  }, [projects, quotes, threads, nowIso]);

  // Pre-group quotes and threads by project_id for panel
  const quotesByProjectId = useMemo(() => {
    return groupByProjectId(quotes, (q) => q.project_id || q.projectId);
  }, [quotes]);

  const threadsByProjectId = useMemo(() => {
    return groupByProjectId(threads, (t) => t.project_id || t.projectId);
  }, [threads]);

  // Get selected project data for panel
  const selectedProject = useMemo(() => {
    if (!selectedLead) return null;
    return projects.find((p) => p.id === selectedLead.project_id) || null;
  }, [selectedLead, projects]);

  const selectedQuotes = useMemo(() => {
    if (!selectedLead) return [];
    return quotesByProjectId[selectedLead.project_id] || [];
  }, [selectedLead, quotesByProjectId]);

  const selectedThreads = useMemo(() => {
    if (!selectedLead) return [];
    return threadsByProjectId[selectedLead.project_id] || [];
  }, [selectedLead, threadsByProjectId]);

  // Client-side filtering
  const filteredLeads = useMemo(() => {
    let filtered = leadViews;

    // Search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter((lead) => {
        const customerName = (lead.customer_name || "").toLowerCase();
        const suburb = (lead.address_suburb || "").toLowerCase();
        const projectNumber = String(lead.project_number || "").toLowerCase();
        const title = (lead.title || "").toLowerCase();
        return (
          customerName.includes(search) ||
          suburb.includes(search) ||
          projectNumber.includes(search) ||
          title.includes(search)
        );
      });
    }

    // Stage filter
    if (stageFilter !== "all") {
      filtered = filtered.filter((lead) => lead.lead_stage === stageFilter);
    }

    // Temperature filter
    if (tempFilter !== "all") {
      filtered = filtered.filter((lead) => lead.temperature_bucket === tempFilter);
    }

    return filtered;
  }, [leadViews, searchTerm, stageFilter, tempFilter]);

  // Loading state
  const isLoading = projectsLoading || quotesLoading || threadsLoading;
  const error = projectsError || quotesError || threadsError;

  // Refetch all
  const handleRefresh = () => {
    refetchProjects();
    refetchQuotes();
    refetchThreads();
  };

  // Row click handler - open side panel
  const handleRowClick = (lead) => {
    setSelectedLead(lead);
    setPanelOpen(true);
  };

  // Create follow-up task handler
  const handleCreateTask = async (lead, e) => {
    e?.stopPropagation(); // Prevent row click

    const projectId = lead.project_id;

    // Check if already creating or created
    if (creatingTaskByProjectId[projectId] || taskCreatedByProjectId[projectId]) {
      return;
    }

    setCreatingTaskByProjectId((prev) => ({ ...prev, [projectId]: true }));

    try {
      const project = projects.find((p) => p.id === projectId);
      const threadsForProject = threadsByProjectId[projectId] || [];

      await createFollowUpTask({
        lead,
        project,
        threadsForProject,
        base44,
        nowIso,
      });

      toast.success("Follow-up task created");
      setTaskCreatedByProjectId((prev) => ({ ...prev, [projectId]: true }));
    } catch (error) {
      console.error("Error creating task:", error);
      toast.error("Could not create task — please try again");
    } finally {
      setCreatingTaskByProjectId((prev) => ({ ...prev, [projectId]: false }));
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <p className="text-red-600 mb-4">Error loading leads data</p>
              <Button onClick={handleRefresh}>Retry</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TrendingUp className="w-8 h-8" />
            Leads
          </h1>
          <p className="text-muted-foreground mt-1">
            {isLoading ? "Loading..." : `${filteredLeads.length} active leads`}
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search customer, suburb, project #, title..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Stage filter */}
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                <SelectItem value={LEAD_STAGES.NEW}>New</SelectItem>
                <SelectItem value={LEAD_STAGES.PRICING}>Pricing</SelectItem>
                <SelectItem value={LEAD_STAGES.QUOTE_DRAFT}>Quote Draft</SelectItem>
                <SelectItem value={LEAD_STAGES.QUOTE_SENT}>Quote Sent</SelectItem>
                <SelectItem value={LEAD_STAGES.ENGAGED}>Engaged</SelectItem>
                <SelectItem value={LEAD_STAGES.STALLED}>Stalled</SelectItem>
                <SelectItem value={LEAD_STAGES.WON}>Won</SelectItem>
                <SelectItem value={LEAD_STAGES.LOST}>Lost</SelectItem>
              </SelectContent>
            </Select>

            {/* Temperature filter */}
            <Select value={tempFilter} onValueChange={setTempFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Temperature" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Temps</SelectItem>
                <SelectItem value={TEMP_BUCKETS.HOT}>Hot</SelectItem>
                <SelectItem value={TEMP_BUCKETS.WARM}>Warm</SelectItem>
                <SelectItem value={TEMP_BUCKETS.COLD}>Cold</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">
              Loading leads...
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No leads found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Temp</TableHead>
                    <TableHead className="text-right">Quote Value</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead>Recommended Action</TableHead>
                    <TableHead>Follow-up Due</TableHead>
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="w-32"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow
                      key={lead.project_id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(lead)}
                    >
                      {/* Customer */}
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{lead.customer_name || "—"}</span>
                          {lead.address_suburb && (
                            <span className="text-xs text-muted-foreground">{lead.address_suburb}</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Stage */}
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {lead.lead_stage.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>

                      {/* Temperature */}
                      <TableCell>
                        <Badge
                          variant={
                            lead.temperature_bucket === TEMP_BUCKETS.HOT
                              ? "error"
                              : lead.temperature_bucket === TEMP_BUCKETS.WARM
                              ? "warning"
                              : "default"
                          }
                          className="capitalize"
                        >
                          {lead.temperature_bucket}
                        </Badge>
                      </TableCell>

                      {/* Quote Value */}
                      <TableCell className="text-right font-medium">
                        {formatCurrency(lead.primary_quote_value)}
                      </TableCell>

                      {/* Last Customer Activity */}
                      <TableCell className="text-muted-foreground">
                        {formatDaysSince(lead.days_since_customer)}
                      </TableCell>

                      {/* Recommended Action */}
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium capitalize">
                            {lead.next_action.replace(/_/g, " ")}
                          </span>
                          {lead.next_action_reason && (
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {lead.next_action_reason}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Follow-up Due */}
                      <TableCell className="text-muted-foreground">
                        {lead.follow_up_due_at ? (
                          <span className="text-sm">Due now</span>
                        ) : (
                          "—"
                        )}
                      </TableCell>

                      {/* Unread indicator */}
                      <TableCell>
                        {lead.has_unread && (
                          <Mail className="w-4 h-4 text-blue-600" title="Has unread messages" />
                        )}
                      </TableCell>

                      {/* Create Task button */}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => handleCreateTask(lead, e)}
                          disabled={
                            creatingTaskByProjectId[lead.project_id] ||
                            taskCreatedByProjectId[lead.project_id]
                          }
                        >
                          {creatingTaskByProjectId[lead.project_id]
                            ? "Creating..."
                            : taskCreatedByProjectId[lead.project_id]
                            ? "Created"
                            : "Create Task"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lead Side Panel */}
      <LeadSidePanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        lead={selectedLead}
        project={selectedProject}
        quotes={selectedQuotes}
        threads={selectedThreads}
      />
    </div>
  );
}