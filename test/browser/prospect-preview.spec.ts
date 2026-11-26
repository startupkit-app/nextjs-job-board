import { expect, test } from "@playwright/test";

const prefix = process.env.KIT_TEST_BASE_PATH ?? "";
const apiUrl = process.env.KIT_TEST_API_URL!;

test.beforeEach(async ({ request }) => {
  test.skip(!process.env.KIT_TEST_PREVIEW);
  await request.delete(`${apiUrl}/__submissions`);
  await request.delete(`${apiUrl}/__preview_revocation`);
});

test("prospect preview is browsable from a fresh session and collects no applicant data", async ({ page, context, request, baseURL }) => {
  const externalRequests: string[] = [];
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin === baseURL) return route.continue();
    externalRequests.push(url.pathname);
    return route.abort();
  });

  const robots = await request.get(`${prefix}/robots.txt`);
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("Allow: /");
  expect(await robots.text()).not.toContain("Sitemap");
  const site = await request.get(`${prefix}/`);
  expect(site.status()).toBe(200);
  expect(site.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  expect(site.headers()["cache-control"]).toContain("no-store");
  expect(site.headers()["set-cookie"]).toBeUndefined();
  expect(await site.text()).not.toContain("dp_browser_fixture");

  const logo = await request.get(`${prefix}/preview-assets/logo`);
  expect(logo.status()).toBe(200);
  expect(logo.headers()["content-type"]).toBe("image/png");
  expect(logo.headers()["cache-control"]).toContain("no-store");
  expect(logo.headers()["x-robots-tag"]).toBe("noindex, nofollow");

  await page.goto(`${prefix}/jobs/design-token/apply`);
  await expect(page.getByRole("heading", { name: "Sample application" })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${prefix}/jobs/design-token/apply$`));

  await page.goto(`${prefix}/`);
  await expect(page.getByRole("heading", { name: "Sample roles" })).toBeVisible();
  await expect(page.getByText("Unlisted demo", { exact: false })).toBeVisible();
  await expect(page.locator(`img[src="${prefix}/preview-assets/logo"]`)).toHaveJSProperty("naturalWidth", 1);
  await expect(page.locator(`[style*="${prefix}/preview-assets/background"]`)).toBeVisible();
  await expect(page.getByText("Join our talent pool")).toHaveCount(0);
  await expect(page.getByText(/Posted /)).toHaveCount(0);

  await page.getByRole("link", { name: /Product Designer/ }).click();
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  const detail = await request.get(`${prefix}/jobs/design-token`);
  expect(detail.headers()["cache-control"]).toContain("no-store");
  expect(detail.headers()["x-robots-tag"]).toBe("noindex, nofollow");

  await page.getByRole("link", { name: "Preview application" }).first().click();
  await expect(page.getByRole("heading", { name: "Sample application" })).toBeVisible();
  await expect(page.locator('form, input[type="file"]')).toHaveCount(0);
  await page.getByText("See sample confirmation").click();
  await expect(page.getByText("Thanks for applying.", { exact: false })).toBeVisible();
  expect(await context.cookies()).toEqual([]);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  expect(externalRequests).toEqual([]);
  expect(await (await request.get(`${apiUrl}/__submissions`)).json()).toEqual([]);
});

test("prospect preview stops serving roles and branding after key revocation", async ({ page, request }) => {
  await page.goto(`${prefix}/`);
  await expect(page.getByRole("heading", { name: "Sample roles" })).toBeVisible();

  await request.post(`${apiUrl}/__preview_revocation`);
  try {
    await page.reload();
    await expect(page.getByRole("heading", { name: "Demo unavailable" })).toBeVisible();
    await expect(page.getByText("Product Designer")).toHaveCount(0);
    await expect(page.locator('img[src*="preview-assets"]')).toHaveCount(0);
    await page.goto(`${prefix}/jobs/design-token`);
    await expect(page.getByRole("heading", { name: "Preview page unavailable" })).toBeVisible();
    expect((await request.get(`${prefix}/preview-assets/logo`)).status()).toBe(404);
  } finally {
    await request.delete(`${apiUrl}/__preview_revocation`);
  }
});
