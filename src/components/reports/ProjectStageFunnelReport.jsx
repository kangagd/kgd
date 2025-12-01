import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { countProjectsByStage } from "@/components/domain/reportingHelpers";

export default function ProjectStageFunnelReport({ projects }) {
  const data = React.useMemo(() => countProjectsByStage(projects || []), [projects]);

  if (!projects || projects.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Project Stage Funnel</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px] text-slate-500">
          No project data available for this period.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Project Stage Funnel</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis 
                dataKey="stage" 
                tick={{ fontSize: 12 }} 
                interval={0} 
                angle={-45} 
                textAnchor="end" 
                height={80} 
              />
              <YAxis allowDecimals={false} />
              <Tooltip 
                cursor={{ fill: 'transparent' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="count" fill="#FAE008" radius={[4, 4, 0, 0]} name="Projects" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}