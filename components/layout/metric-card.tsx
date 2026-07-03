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
    blue: "text-[#0369a1] bg-sky-50 ring-1 ring-sky-100",
    navy: "text-[#1e293b] bg-slate-50 ring-1 ring-slate-100",
    red: "text-red-700 bg-red-50 ring-1 ring-red-100",
  }[tone];

  return (
    <Card className="min-w-0 overflow-hidden bg-white transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
      <CardContent className="flex min-h-[168px] flex-col p-5">
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black leading-snug text-[#475569]">{title}</p>
            <p className="mt-3 max-w-full break-words text-3xl font-black leading-tight tracking-normal text-[#0f172a] xl:text-[2.15rem]">{value}</p>
          </div>
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", toneClass)}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
        <p className="mt-auto pt-4 text-sm font-semibold leading-relaxed text-[#64748b]">{helper}</p>
      </CardContent>
    </Card>
  );
}
