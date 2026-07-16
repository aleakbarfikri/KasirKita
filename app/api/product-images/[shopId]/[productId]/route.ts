import { get } from "@vercel/blob";

import { readDb } from "@/lib/server/data-store";

type Params = { params: Promise<{ shopId: string; productId: string }> };

export const runtime = "nodejs";

function blobToken() {
  return process.env.KASIRKITA_PRODUCT_BLOB_READ_WRITE_TOKEN?.trim() || process.env.BLOB_READ_WRITE_TOKEN?.trim() || "";
}

function productPath(shopId: string, productId: string) {
  return `product-images/${shopId}/${productId}.webp`;
}

export async function GET(request: Request, props: Params) {
  const { shopId, productId } = await props.params;
  const token = blobToken();
  if (!token) return new Response("Not found", { status: 404 });

  const db = await readDb();
  const product = db.products.find((row) => row.id === productId && row.shopId === shopId && row.isActive && row.photoUrl);
  if (!product) return new Response("Not found", { status: 404 });

  try {
    const etag = request.headers.get("if-none-match");
    const result = await get(productPath(shopId, productId), {
      token,
      access: "private",
      headers: etag ? { "if-none-match": etag } : undefined,
    });
    if (!result) return new Response("Not found", { status: 404 });
    if (result.statusCode === 304) return new Response(null, { status: 304, headers: { ETag: result.blob.etag } });

    return new Response(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType || "image/webp",
        "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable",
        ETag: result.blob.etag,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
