import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function BackButton({ onClick, to, label = "Back", className = "" }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (to) {
      navigate(to);
    } else {
      navigate(-1);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className={`text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] h-9 px-3 gap-2 rounded-lg transition-all ${className}`}
    >
      <ArrowLeft className="w-4 h-4" />
      <span className="text-[12px] font-medium">{label}</span>
    </Button>
  );
}