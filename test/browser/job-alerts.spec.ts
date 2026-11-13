import { expect, test } from "@playwright/test";

const prefix = process.env.KIT_TEST_BASE_PATH ?? "";
const apiUrl = process.env.KIT_TEST_API_URL!;

test.beforeEach(async ({ request, context, baseURL }) => {
  await request.delete(`${apiUrl}/__submissions`);
  await context.route("**/*", (route) => new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort());
});

test("email alerts confirm separately before offering a talent-pool application", async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${prefix}/?department=Engineering&locale=pl`);
  const alerts = page.getByRole("region", { name: "Get new roles by email" });
  await expect(alerts).toContainText("All new roles, regardless of your current filters");
  await expect(alerts.getByRole("link", { name: "Privacy policy" })).toHaveAttribute("href", "https://example.test/privacy");
  if (process.env.KIT_CAPTURE_JOB_ALERTS) await page.screenshot({ path: `${process.env.KIT_CAPTURE_JOB_ALERTS}/${prefix ? "careers" : "root"}-alerts-mobile.png`, fullPage: true });
  await alerts.getByRole("textbox", { name: "Email address" }).fill("subscriber@example.test");
  await alerts.getByRole("button", { name: "Get job alerts", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Check your inbox");
  await expect(page.getByRole("status")).toBeFocused();
  if (process.env.KIT_CAPTURE_JOB_ALERTS) await page.screenshot({ path: `${process.env.KIT_CAPTURE_JOB_ALERTS}/${prefix ? "careers" : "root"}-alerts-success-mobile.png`, fullPage: true });
  await expect(page).toHaveURL((url) => !url.href.includes("subscriber"));
  const submissions = await (await request.get(`${apiUrl}/__submissions`)).json();
  expect(submissions).toEqual([{ path: "/api/public/v1/job_alert_subscriptions", body: { job_alert_subscription: { email: "subscriber@example.test", locale: "pl" } } }]);
  await page.getByRole("link", { name: "Join the talent pool →", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === `${prefix}/talent-pool` && !url.searchParams.has("email"));
  await expect(page.getByRole("checkbox", { name: "Keep my details for future roles." })).not.toBeChecked();
});

test("a rejected alert request keeps the email and focuses its error", async ({ page, request }) => {
  await page.goto(`${prefix}/`);
  const email = page.getByRole("textbox", { name: "Email address" });
  await email.fill("reject@example.test");
  await page.getByRole("button", { name: "Get job alerts", exact: true }).click();
  await expect(page.getByRole("region", { name: "Get new roles by email" }).getByRole("alert")).toContainText("Check your email address");
  await expect(email).toHaveValue("reject@example.test");
  await expect(email).toBeFocused();
  expect(await (await request.get(`${apiUrl}/__submissions`)).json()).toEqual([]);
});
