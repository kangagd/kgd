import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

export default function EntityCard({ 
  children, 
  onClick, 
  onViewDetails,
  className = ""
}) {
  return (
    <Card
      className={`hover:shadow-lg transition-all duration-200 cursor-pointer hover:border-[#FAE008] border border-[#E5E7EB] rounded-xl relative group ${className}`}
      onClick={onClick}
    >
      {onViewDetails && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-8 w-8 rounded-lg hover:bg-[#F3F4F6] z-10 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails();
          }}
        >
          <Eye className="w-4 h-4 text-[#6B7280]" />
        </Button>
      )}
      <CardContent className="p-4">
        {children}
      </CardContent>
    </Card>
  );
}