import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function ProjectContextPanel({ project }) {
  return (
    <div className="space-y-4 sticky top-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Project Context</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-[#6B7280]">
            Context panel placeholder
          </p>
        </CardContent>
      </Card>
    </div>
  );
}