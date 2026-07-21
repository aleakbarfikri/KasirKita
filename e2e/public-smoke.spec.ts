import { expect, test } from "@playwright/test";

test("public entry points render and health check stays tenant-safe", async ({ page, request }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/KasirKita/i);

  await page.goto("/login");
  await expect(page.locator("body")).toContainText(/login|masuk/i);

  await page.goto("/pricing");
  await expect(page.locator("body")).toContainText(/paket|pricing/i);

  const health = await request.get("/api/health");
  expect(health.ok()).toBeTruthy();
  const payload = await health.json();
  expect(payload).toMatchObject({ ok: true, status: "healthy" });
  expect(JSON.stringify(payload)).not.toMatch(/user|shop|email|token/i);
});
