import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "secondary" | "outline" | "success" | "warning" | "danger" | "blue";
};

const variants = {
  default: "bg-primary text-primary-foreground",
  secondary: "bg-[#eef4f2] text-[#475569]",
  outline: "border border-input bg-background text-foreground",
  success: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  warning: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-1 ring-red-200",
  blue: "bg-sky-50 text-sky-800 ring-1 ring-sky-200",
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return <div className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black uppercase tracking-[0.02em]", variants[variant], className)} {...props} />;
}
