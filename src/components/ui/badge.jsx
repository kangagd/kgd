import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-lg px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#FAE008] focus:ring-offset-2 border-0 shadow-none",
  {
    variants: {
      variant: {
        default: "bg-slate-100 text-slate-700 hover:bg-slate-200",
        primary: "bg-[#FAE008] text-[#111827] hover:bg-[#E5CF07]",
        secondary: "bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]",
        success: "bg-[#16A34A]/10 text-[#16A34A] hover:bg-[#16A34A]/20",
        error: "bg-[#DC2626]/10 text-[#DC2626] hover:bg-[#DC2626]/20",
        warning: "bg-[#D97706]/10 text-[#D97706] hover:bg-[#D97706]/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({ className, variant, ...props }) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }