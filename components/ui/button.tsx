import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive" | "navy";
  size?: "default" | "sm" | "lg" | "icon";
};

const variants = {
  default: "bg-primary text-primary-foreground shadow-[0_8px_18px_rgba(0,105,72,0.16)] hover:bg-[#005c3f]",
  secondary: "bg-[#eef4f2] text-[#0f172a] hover:bg-[#dfe9e5]",
  outline: "border border-[#007a55] bg-white text-primary shadow-sm hover:bg-primary/5",
  ghost: "text-[#334155] hover:bg-[#eef4f2] hover:text-[#0f172a]",
  destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
  navy: "bg-[#1e293b] text-white shadow-[0_8px_18px_rgba(15,23,42,0.16)] hover:bg-[#152033]",
};

const sizes = {
  default: "h-10 px-4 py-2",
  sm: "h-9 rounded-lg px-3 text-xs",
  lg: "h-12 rounded-lg px-8 text-base",
  icon: "h-10 w-10",
};

export function Button({ className, variant = "default", size = "default", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
