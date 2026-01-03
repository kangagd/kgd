import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { formatDistanceToNow, parseISO } from "date-fns";
import { 
  FileText, 
  DollarSign, 
  Calendar, 
  CheckCircle2, 
  Clock,
  AlertCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ActivityTimeline({ project, onNavigateToTab }) {
  const [filter, setFilter] = React.useState("all");

  // Fetch data sources
  const { data: quotes = [] } = useQuery({
    queryKey: ['projectQuotes', project.id],
    queryFn: () => base44.entities.Quote.filter({ project_id: project.id }),
    enabled: !!project.id
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['projectXeroInvoices', project.id],
    queryFn: () => base44.entities.XeroInvoice.filter({ project_id: project.id }),
    enabled: !!project.id
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['projectJobs', project.id],
    queryFn: () => base44.entities.Job.filter({ project_id: project.id }),
    enabled: !!project.id
  });

  const { data: changeHistory = [] } = useQuery({
    queryKey: ['projectChangeHistory', project.id],
    queryFn: () => base44.entities.ChangeHistory.filter({ project_id: project.id }, '-created_date', 50),
    enabled: !!project.id
  });

  // Build timeline events
  const timelineEvents = React.useMemo(() => {
    const events = [];

    // Quote events
    quotes.forEach(quote => {
      if (quote.created_date) {
        events.push({
          id: `quote-created-${quote.id}`,
          timestamp: parseISO(quote.created_date),
          type: 'quote',
          category: 'sales',
          action: 'created',
          title: 'Quote Created',
          description: `Quote ${quote.quote_number || ''} created`,
          icon: FileText,
          color: 'blue',
          metadata: { quoteId: quote.id, status: quote.status }
        });
      }

      if (quote.sent_at) {
        events.push({
          id: `quote-sent-${quote.id}`,
          timestamp: parseISO(quote.sent_at),
          type: 'quote',
          category: 'sales',
          action: 'sent',
          title: 'Quote Sent',
          description: `Quote ${quote.quote_number || ''} sent to client`,
          icon: FileText,
          color: 'purple',
          metadata: { quoteId: quote.id, status: quote.status }
        });
      }

      if (quote.status === 'Approved' && quote.updated_date) {
        events.push({
          id: `quote-approved-${quote.id}`,
          timestamp: parseISO(quote.updated_date),
          type: 'quote',
          category: 'sales',
          action: 'approved',
          title: 'Quote Approved',
          description: `Quote ${quote.quote_number || ''} approved by client`,
          icon: CheckCircle2,
          color: 'green',
          metadata: { quoteId: quote.id, status: quote.status }
        });
      }

      if (quote.status === 'Declined' && quote.updated_date) {
        events.push({
          id: `quote-declined-${quote.id}`,
          timestamp: parseISO(quote.updated_date),
          type: 'quote',
          category: 'sales',
          action: 'declined',
          title: 'Quote Declined',
          description: `Quote ${quote.quote_number || ''} declined`,
          icon: AlertCircle,
          color: 'red',
          metadata: { quoteId: quote.id, status: quote.status }
        });
      }
    });

    // Invoice events
    invoices.forEach(invoice => {
      if (invoice.created_date) {
        events.push({
          id: `invoice-created-${invoice.id}`,
          timestamp: parseISO(invoice.created_date),
          type: 'invoice',
          category: 'sales',
          action: 'created',
          title: 'Invoice Created',
          description: `Invoice ${invoice.invoice_number || ''} - $${(invoice.total_amount || 0).toFixed(2)}`,
          icon: DollarSign,
          color: 'blue',
          metadata: { invoiceId: invoice.id }
        });
      }

      if (invoice.status === 'Paid' && invoice.updated_date) {
        events.push({
          id: `invoice-paid-${invoice.id}`,
          timestamp: parseISO(invoice.updated_date),
          type: 'invoice',
          category: 'sales',
          action: 'paid',
          title: 'Payment Received',
          description: `Invoice ${invoice.invoice_number || ''} fully paid`,
          icon: CheckCircle2,
          color: 'green',
          metadata: { invoiceId: invoice.id }
        });
      }

      if (invoice.amount_paid > 0 && invoice.amount_paid < invoice.total_amount && invoice.updated_date) {
        events.push({
          id: `invoice-partial-${invoice.id}`,
          timestamp: parseISO(invoice.updated_date),
          type: 'invoice',
          category: 'sales',
          action: 'partial_payment',
          title: 'Partial Payment Received',
          description: `$${invoice.amount_paid.toFixed(2)} of $${invoice.total_amount.toFixed(2)}`,
          icon: DollarSign,
          color: 'yellow',
          metadata: { invoiceId: invoice.id }
        });
      }
    });

    // Job/Visit events
    jobs.forEach(job => {
      if (job.scheduled_date && job.status === 'Scheduled') {
        events.push({
          id: `job-scheduled-${job.id}`,
          timestamp: job.updated_date ? parseISO(job.updated_date) : parseISO(job.created_date),
          type: 'visit',
          category: 'ops',
          action: 'scheduled',
          title: 'Visit Scheduled',
          description: `${job.job_type_name || 'Job'} scheduled`,
          icon: Calendar,
          color: 'blue',
          metadata: { jobId: job.id }
        });
      }

      if (job.status === 'Completed' && job.updated_date) {
        events.push({
          id: `job-completed-${job.id}`,
          timestamp: parseISO(job.updated_date),
          type: 'visit',
          category: 'ops',
          action: 'completed',
          title: 'Visit Completed',
          description: `${job.job_type_name || 'Job'} completed`,
          icon: CheckCircle2,
          color: 'green',
          metadata: { jobId: job.id }
        });
      }
    });

    // Sort by timestamp descending and take top 12
    return events
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 12);
  }, [quotes, invoices, jobs, changeHistory]);

  // Filter events
  const filteredEvents = React.useMemo(() => {
    if (filter === 'all') return timelineEvents;
    return timelineEvents.filter(e => e.category === filter);
  }, [timelineEvents, filter]);

  const getIconColor = (color) => {
    const colors = {
      blue: 'text-blue-600',
      green: 'text-green-600',
      purple: 'text-purple-600',
      red: 'text-red-600',
      yellow: 'text-yellow-600',
      orange: 'text-orange-600'
    };
    return colors[color] || 'text-gray-600';
  };

  const getBadgeColor = (color) => {
    const colors = {
      blue: 'bg-blue-100 text-blue-700',
      green: 'bg-green-100 text-green-700',
      purple: 'bg-purple-100 text-purple-700',
      red: 'bg-red-100 text-red-700',
      yellow: 'bg-yellow-100 text-yellow-700',
      orange: 'bg-orange-100 text-orange-700'
    };
    return colors[color] || 'bg-gray-100 text-gray-700';
  };

  const handleEventClick = (event) => {
    if (!onNavigateToTab) return;

    // Navigate based on event type
    if (event.type === 'quote') {
      onNavigateToTab('quotes');
    } else if (event.type === 'invoice') {
      onNavigateToTab('invoicing');
    } else if (event.type === 'visit') {
      onNavigateToTab('requirements');
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Tabs value={filter} onValueChange={setFilter} className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
          <TabsTrigger value="sales" className="flex-1">Sales</TabsTrigger>
          <TabsTrigger value="ops" className="flex-1">Ops</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Timeline */}
      {filteredEvents.length === 0 ? (
        <div className="text-center py-8">
          <Clock className="w-12 h-12 text-[#E5E7EB] mx-auto mb-3" />
          <p className="text-[14px] text-[#9CA3AF]">No {filter === 'all' ? 'recent' : filter} activity</p>
        </div>
      ) : (
        <div className="space-y-0">
          {filteredEvents.map((event, idx) => {
          const Icon = event.icon;
          return (
            <div 
              key={event.id}
              onClick={() => handleEventClick(event)}
              className={`flex gap-3 py-3 border-b border-[#E5E7EB] last:border-0 ${onNavigateToTab ? 'cursor-pointer hover:bg-[#F9FAFB] -mx-2 px-2 rounded-lg transition-colors' : ''}`}
            >
              {/* Icon with connector line */}
              <div className="relative flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-white border-2 ${getBadgeColor(event.color).replace('bg-', 'border-')}`}>
                  <Icon className={`w-4 h-4 ${getIconColor(event.color)}`} />
                </div>
                {idx < filteredEvents.length - 1 && (
                  <div className="w-px h-full bg-[#E5E7EB] mt-1"></div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-[14px] font-medium text-[#111827]">
                    {event.title}
                  </span>
                  <span className="text-[11px] text-[#6B7280] whitespace-nowrap">
                    {formatDistanceToNow(event.timestamp, { addSuffix: true })}
                  </span>
                </div>
                <p className="text-[13px] text-[#4B5563]">
                  {event.description}
                </p>
              </div>
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
}