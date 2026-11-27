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

test("desktop/mobile viewport screenshots have no horizontal overflow", async ({ page }) => {
  await page.goto("/setup");
  for (const width of [360, 390, 768, 1280, 1536]) {
    const height = width <= 390 ? 844 : width === 768 ? 1024 : 900;
    await page.setViewportSize({ width, height });
    await expect(page.getByRole("heading", { name: "Siapkan akun admin" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `horizontal overflow at ${width}px`).toBe(true);
    await page.screenshot({ path: `test-results/screens/setup-${width}x${height}.png`, fullPage: false });
  }
});
