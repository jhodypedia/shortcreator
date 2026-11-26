import { expect, test } from "@playwright/test";

test("responsive studio entry renders with mobile-safe controls", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/setup");
  await expect(page.getByRole("heading", { name: "Siapkan akun admin" })).toBeVisible();
  await expect(page.getByLabel("Kata sandi", { exact: true })).toBeVisible();
  const box = await page.getByRole("button", { name: "Buat akun admin" }).boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
