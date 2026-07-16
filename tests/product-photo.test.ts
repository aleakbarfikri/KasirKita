import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";

import { optimizedProductImage, productImageUrl } from "../app/api/products/[id]/photo/route";
import { PLAN_CONFIG } from "../lib/server/subscription";

test("product photo upload is restricted to Pro and Business", () => {
  assert.equal(PLAN_CONFIG.trial.features.productPhotos, false);
  assert.equal(PLAN_CONFIG.basic.features.productPhotos, false);
  assert.equal(PLAN_CONFIG.starter.features.productPhotos, false);
  assert.equal(PLAN_CONFIG.pro.features.productPhotos, true);
  assert.equal(PLAN_CONFIG.business.features.productPhotos, true);
});

test("product photos are resized and converted to compact WebP", async () => {
  const source = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#15803d" } }).png().toBuffer();
  const output = await optimizedProductImage(source);
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.format, "webp");
  assert.ok((metadata.width ?? 0) <= 1200);
  assert.ok((metadata.height ?? 0) <= 1200);
  assert.ok(output.length < source.length);
});

test("invalid product photo payloads are rejected", async () => {
  await assert.rejects(() => optimizedProductImage(Buffer.from("not-an-image")));
});

test("private product photos are exposed only through the KasirKita image route", () => {
  assert.equal(productImageUrl("shop 1", "product/1", 123), "/api/product-images/shop%201/product%2F1?v=123");
});
