import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function Modal({
  open,
  title,
  description,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <Card className="max-h-[90vh] w-full max-w-xl overflow-auto shadow-[0_24px_80px_rgba(15,23,42,0.24)]">
        <div className="flex items-start justify-between border-b border-[#e2e8f0] p-5">
          <div>
            <h2 className="text-xl font-black text-[#0f172a]">{title}</h2>
            {description ? <p className="mt-1 text-sm font-medium leading-relaxed text-[#64748b]">{description}</p> : null}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Tutup modal">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="p-5">{children}</div>
      </Card>
    </div>
  );
}
