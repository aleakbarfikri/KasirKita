import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({
  title,
  value,
  helper,
  icon: Icon,
  tone = "green",
}: {
  title: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  tone?: "green" | "blue" | "navy" | "red";
}) {
  const toneClass = {
    green: "text-primary bg-primary/10",
    blue: "text-[#00628d] bg-[#c9e6ff]",
    navy: "text-[#213145] bg-[#dae2fd]",
    red: "text-red-700 bg-red-100",
  }[tone];

  return (
    <Card className="overflow-hidden bg-white">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[#3d4a42]">{title}</p>
            <p className="mt-3 text-4xl font-extrabold tracking-tight text-[#0b1c30] md:text-5xl">{value}</p>
          </div>
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", toneClass)}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
        <p className="mt-4 text-sm font-medium text-[#3d4a42]">{helper}</p>
      </CardContent>
    </Card>
  );
}
