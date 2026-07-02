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
    <Card className="min-w-0 overflow-hidden bg-white">
      <CardContent className="flex min-h-[170px] flex-col p-5">
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-snug text-[#3d4a42]">{title}</p>
            <p className="mt-3 max-w-full break-words text-3xl font-extrabold leading-tight tracking-normal text-[#0b1c30] xl:text-[2.15rem]">{value}</p>
          </div>
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", toneClass)}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
        <p className="mt-auto pt-4 text-sm font-medium leading-relaxed text-[#3d4a42]">{helper}</p>
      </CardContent>
    </Card>
  );
}
