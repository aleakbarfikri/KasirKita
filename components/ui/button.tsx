import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive" | "navy";
  size?: "default" | "sm" | "lg" | "icon";
};

const variants = {
  default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  outline: "border border-primary bg-white text-primary hover:bg-primary/5",
  ghost: "hover:bg-secondary/60 hover:text-foreground",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  navy: "bg-[#213145] text-white hover:bg-[#172437]",
};

const sizes = {
  default: "h-10 px-4 py-2",
  sm: "h-9 rounded-lg px-3 text-xs",
  lg: "h-12 rounded-xl px-8 text-base",
  icon: "h-10 w-10",
};

export function Button({ className, variant = "default", size = "default", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
