import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import { DollarSign, FileText, CheckCircle2, XCircle, Clock } from "lucide-react";

const COLORS = ['#FAE008', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6'];

export default function QuotesReport({ dateFrom, dateTo }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");

  const { data: quotes = [] } = useQuery({
    queryKey: ['quotes'],
    queryFn: () => base44.entities.Quote.list()
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list()
  });

  const filteredQuotes = useMemo(() => {
    return quotes.filter(q => {
      if (q.deleted_at) return false;

      const createdDate = new Date(q.created_date);
      const fromDate = new Date(dateFrom);
      const toDate = new Date(dateTo);
      // Adjust toDate to end of day
      toDate.setHours(23, 59, 59, 999);

      if (createdDate < fromDate || createdDate > toDate) return false;

      if (statusFilter !== "all" && q.status !== statusFilter) return false;
      if (customerFilter !== "all" && q.customer_id !== customerFilter) return false;

      return true;
    });
  }, [quotes, dateFrom, dateTo, statusFilter, customerFilter]);

  const metrics = useMemo(() => {
    const totalQuotes = filteredQuotes.length;
    const totalValue = filteredQuotes.reduce((sum, q) => sum + (q.value || 0), 0);
    
    const accepted = filteredQuotes.filter(q => q.status === 'Accepted');
    const acceptedValue = accepted.reduce((sum, q) => sum + (q.value || 0), 0);
    
    const acceptanceRate = totalQuotes > 0 ? ((accepted.length / totalQuotes) * 100).toFixed(1) : 0;
    
    const sent = filteredQuotes.filter(q => q.status === 'Sent').length;
    const draft = filteredQuotes.filter(q => q.status === 'Draft').length;
    const declined = filteredQuotes.filter(q => q.status === 'Declined').length;

    return { totalQuotes, totalValue, acceptedValue, acceptanceRate, sent, draft, declined, accepted: accepted.length };
  }, [filteredQuotes]);

  const statusData = useMemo(() => {
    const counts = {};
    filteredQuotes.forEach(q => {
      const status = q.status || 'Unknown';
      counts[status] = (counts[status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredQuotes]);

  const valueByStatusData = useMemo(() => {
    const values = {};
    filteredQuotes.forEach(q => {
      const status = q.status || 'Unknown';
      values[status] = (values[status] || 0) + (q.value || 0);
    });
    return Object.entries(values).map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [filteredQuotes]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="border border-[#E5E7EB]">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Sent">Sent</SelectItem>
                  <SelectItem value="Accepted">Accepted</SelectItem>
                  <SelectItem value="Declined">Declined</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Customer</Label>
              <Select value={customerFilter} onValueChange={setCustomerFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Customers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border border-[#E5E7EB]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500 font-medium">Total Quotes</span>
              <FileText className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{metrics.totalQuotes}</div>
            <div className="text-xs text-gray-500 mt-1">${metrics.totalValue.toLocaleString()} Total Value</div>
          </CardContent>
        </Card>

        <Card className="border border-[#E5E7EB]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500 font-medium">Accepted Value</span>
              <DollarSign className="w-5 h-5 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">${metrics.acceptedValue.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">{metrics.accepted} Accepted Quotes</div>
          </CardContent>
        </Card>

        <Card className="border border-[#E5E7EB]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500 font-medium">Acceptance Rate</span>
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{metrics.acceptanceRate}%</div>
            <div className="text-xs text-gray-500 mt-1">Based on filtered quotes</div>
          </CardContent>
        </Card>

        <Card className="border border-[#E5E7EB]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500 font-medium">Pending</span>
              <Clock className="w-5 h-5 text-yellow-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{metrics.sent + metrics.draft}</div>
            <div className="text-xs text-gray-500 mt-1">{metrics.sent} Sent, {metrics.draft} Draft</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border border-[#E5E7EB]">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Quotes by Status (Count)</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-gray-500 py-12">No data available</div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-[#E5E7EB]">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Quote Value by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {valueByStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={valueByStatusData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                  <Bar dataKey="value" fill="#3B82F6">
                     {valueByStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-gray-500 py-12">No data available</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}