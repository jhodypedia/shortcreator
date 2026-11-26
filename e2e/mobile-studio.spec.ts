import { expect, test } from "@playwright/test";

test("responsive studio entry renders with mobile-safe controls", async ({ page }) => {
  await page.goto("/setup");
  await expect(page.getByRole("heading", { name: "Siapkan akun admin" })).toBeVisible();
  await expect(page.getByLabel("Kata sandi", { exact: true })).toBeVisible();
  for (const width of [360, 390, 768, 1280, 1536]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
    const box = await page.getByRole("button", { name: "Buat akun admin" }).boundingBox();
    expect(box?.height, `touch target at ${width}px`).toBeGreaterThanOrEqual(44);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, `horizontal overflow at ${width}px`).toBe(false);
  }
});
