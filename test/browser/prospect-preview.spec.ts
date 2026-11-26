import { expect, test } from "@playwright/test";

const prefix = process.env.KIT_TEST_BASE_PATH ?? "";

test("prospect preview keeps roles and uploaded identity private and uses a sample application", async ({ page, context, request }) => {
  test.skip(!process.env.KIT_TEST_PREVIEW);
  await request.delete(`${process.env.KIT_TEST_API_URL}/__submissions`);

  const lockedAsset = await request.get(`${prefix}/preview-assets/logo`);
  expect(lockedAsset.status()).toBe(404);

  await page.goto(`${prefix}/jobs/design-token/apply`);
  await expect(page).toHaveURL(new RegExp(`${prefix}/preview-access$`));
  await expect(page.getByRole("heading", { name: "Private careers preview" })).toBeVisible();
  await expect(page.getByText("Product Designer")).toHaveCount(0);
  await expect(page.locator('img[src*="preview-assets"]')).toHaveCount(0);

  await page.getByLabel("Preview password").fill("wrong password");
  await page.getByRole("button", { name: "Open preview" }).click();
  await expect(page.getByText("That password didn’t open", { exact: false })).toBeVisible();

  await page.getByLabel("Preview password").fill(process.env.STARTUPKIT_PREVIEW_PASSWORD!);
  await page.getByRole("button", { name: "Open preview" }).click();
  await expect(page.getByRole("heading", { name: "Sample roles" })).toBeVisible();
  const session = (await context.cookies()).find((cookie) => cookie.name === "__Host-kit-careers-preview");
  expect(session).toMatchObject({ secure: true, httpOnly: true, sameSite: "Lax", path: "/" });
  const logo = await context.request.get(`${prefix}/preview-assets/logo`);
  expect(logo.status()).toBe(200);
  expect(logo.headers()["content-type"]).toBe("image/png");
  expect(logo.headers()["cache-control"]).toContain("no-store");
  await expect(page.locator(`img[src="${prefix}/preview-assets/logo"]`)).toHaveJSProperty("naturalWidth", 1);
  await expect(page.locator(`[style*="${prefix}/preview-assets/background"]`)).toBeVisible();
  await expect(page.getByText("Join our talent pool")).toHaveCount(0);
  await expect(page.getByText(/Posted /)).toHaveCount(0);

  await page.getByRole("link", { name: /Product Designer/ }).click();
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await page.getByRole("link", { name: "Preview application" }).first().click();
  await expect(page.getByRole("heading", { name: "Sample application" })).toBeVisible();
  await expect(page.locator('form, input[type="file"]')).toHaveCount(0);
  await page.getByText("See sample confirmation").click();
  await expect(page.getByText("Thanks for applying.", { exact: false })).toBeVisible();

  const submissions = await (await request.get(`${process.env.KIT_TEST_API_URL}/__submissions`)).json();
  expect(submissions).toEqual([]);
  const response = await context.request.get(`${prefix}/jobs/design-token`);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await response.text()).not.toContain("dp_browser_fixture");
});
