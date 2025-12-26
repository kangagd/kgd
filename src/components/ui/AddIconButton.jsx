import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function AddIconButton({ onClick, className = "", title = "Add", type = "button", ...props }) {
  return (
    <Button
      type={type}
      onClick={onClick}
      variant="ghost"
      title={title}
      className={`h-8 w-8 min-w-[32px] rounded-lg p-0 flex items-center justify-center hover:bg-[#FAE008]/20 transition-colors ${className}`}
      {...props}
    >
      <Plus className="w-4 h-4 text-[#6B7280] pointer-events-none" />
    </Button>
  );
}