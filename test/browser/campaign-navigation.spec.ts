import { expect, test, type Page } from "@playwright/test";

const prefix = process.env.KIT_TEST_BASE_PATH ?? "";
const apiUrl = process.env.KIT_TEST_API_URL!;
const campaign = new URLSearchParams({ utm_source: "job-board", utm_medium: "job_feed", utm_campaign: "autumn-hiring", locale: "pl" });

async function expectCampaign(page: Page, path: string) {
  const pathname = path === "/" ? prefix || "/" : `${prefix}${path}`;
  await expect(page).toHaveURL((url) =>
    url.pathname === pathname &&
    [...campaign].every(([key, value]) => url.searchParams.get(key) === value) &&
    !url.searchParams.has("destination") && !url.searchParams.has("email")
  );
}

test.beforeEach(async ({ context, request, baseURL }) => {
  // Even a misconfigured integration must not contact Kit or an external service.
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort()
  );
  await request.delete(`${apiUrl}/__submissions`);
});

test("campaign attribution survives browsing, filter clearing, application and success return", async ({ page, request }) => {
  await page.goto(`${prefix}/jobs/engineering-token?${campaign}&destination=careers&email=do-not-forward@example.test`);
  await expect(page.getByRole("heading", { name: "Platform Engineer", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "← All open roles", exact: true }).click();
  await expectCampaign(page, "/");

  await page.getByRole("combobox", { name: "Department", exact: true }).selectOption("Product");
  await expect(page.getByRole("link", { name: /Platform Engineer/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expectCampaign(page, "/");
  await expect(page.getByRole("combobox", { name: "Department", exact: true })).toHaveValue("");
  await expect(page.getByRole("link", { name: /Platform Engineer/ })).toBeVisible();
  await page.getByRole("link", { name: /Product Designer/ }).click();
  await expectCampaign(page, "/jobs/design-token");
  await page.getByRole("link", { name: "Apply for this role", exact: true }).first().click();
  await expectCampaign(page, "/jobs/design-token/apply");
  await page.getByRole("textbox", { name: "First name", exact: true }).fill("Test");
  await page.getByRole("textbox", { name: "Last name", exact: true }).fill("Applicant");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("applicant@example.test");
  await page.getByRole("button", { name: "Submit application", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Application submitted", exact: true })).toBeVisible();
  const submissions = await (await request.get(`${apiUrl}/__submissions`)).json();
  expect(submissions).toEqual([{ path: "/api/public/v1/jobs/design-token/applications", body: {
    application: { first_name: "Test", last_name: "Applicant", email: "applicant@example.test", responses: {} },
  } }]);
  await page.getByRole("link", { name: "Back to open roles", exact: true }).click();
  await expectCampaign(page, "/");
  await expect(page.getByRole("heading", { name: "Open roles", exact: true })).toBeVisible();
});

test("campaign attribution survives talent-pool submission and its success return", async ({ page, request }) => {
  await page.goto(`${prefix}/?${campaign}`);
  await page.getByRole("link", { name: "Nothing that fits? Join our talent pool →", exact: true }).click();
  await expectCampaign(page, "/talent-pool");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("pool@example.test");
  await page.getByRole("checkbox", { name: "Keep my details for future roles.", exact: true }).check();
  await page.getByRole("button", { name: "Join the talent pool", exact: true }).click();
  await expect(page.getByRole("heading", { name: "One last step — check your inbox", exact: true })).toBeVisible();
  const submissions = await (await request.get(`${apiUrl}/__submissions`)).json();
  expect(submissions).toEqual([{ path: "/api/public/v1/talent_pool/entries", body: {
    talent_pool_entry: expect.objectContaining({ email: "pool@example.test", consent: true }),
  } }]);
  await page.getByRole("status").getByRole("link", { name: "Back to open roles", exact: true }).click();
  await expectCampaign(page, "/");
});

test("missing jobs recover to the job board with campaign attribution", async ({ page }) => {
  await page.goto(`${prefix}/jobs/unknown-token?${campaign}`);
  await expect(page.getByRole("heading", { name: /not found/i })).toBeVisible();
  await page.getByRole("link", { name: /open roles/i }).last().click();
  await expectCampaign(page, "/");
});
