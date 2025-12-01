import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { countJobsByStatus } from "@/components/domain/reportingHelpers";

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#6366F1'];

export default function JobStatusSummaryReport({ jobs }) {
  const data = React.useMemo(() => countJobsByStatus(jobs || []), [jobs]);
  
  // Filter out 0 values for cleaner pie chart
  const activeData = data.filter(d => d.count > 0);

  if (!jobs || jobs.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Job Status Summary</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px] text-slate-500">
          No job data available for this period.
        </CardContent>
      </Card>
    );
  }

  if (activeData.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Job Status Summary</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px] text-slate-500">
          No active jobs found.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Job Status Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={activeData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                outerRadius={100}
                fill="#8884d8"
                dataKey="count"
                nameKey="status"
              >
                {activeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}