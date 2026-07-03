"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppLanguage } from "@/lib/i18n";

const subscriptionErrorPatterns = [
  /paket/i,
  /subscription/i,
  /upgrade/i,
  /limit/i,
  /fitur ini tersedia/i,
  /plan/i,
];

export function isSubscriptionError(message?: string | null) {
  return Boolean(message && subscriptionErrorPatterns.some((pattern) => pattern.test(message)));
}

export function UpgradeSubscriptionCta({ message }: { message?: string | null }) {
  const { t } = useAppLanguage();

  if (!isSubscriptionError(message)) return null;

  return (
    <Link href="/admin#subscription" className="mt-3 inline-flex w-full sm:w-auto">
      <Button type="button" size="sm" className="w-full gap-2 sm:w-auto">
        {t("Lihat Paket Subscription")}
        <ArrowUpRight className="h-4 w-4" />
      </Button>
    </Link>
  );
}
