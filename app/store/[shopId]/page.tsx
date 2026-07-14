import { OnlineStorefront } from "@/components/store/online-storefront";

export default async function StorePage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  return <OnlineStorefront shopId={shopId} />;
}
