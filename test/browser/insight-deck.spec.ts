import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { INSIGHT_TOKEN, insightQuestions } from "./mock-api.mjs";

const prefix = process.env.KIT_TEST_BASE_PATH ?? "";
const apiUrl = process.env.KIT_TEST_API_URL!;
const [city, onCall, work, withdrawn, stack] = insightQuestions;

test.beforeEach(async ({ context, request, baseURL }) => {
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort()
  );
  await request.delete(`${apiUrl}/__submissions`);
});

async function apply(page: Page) {
  await page.goto(`${prefix}/jobs/engineering-token/apply`);
  await page.getByRole("textbox", { name: "First name", exact: true }).fill("Maja");
  await page.getByRole("textbox", { name: "Last name", exact: true }).fill("Kowalczyk");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("maja@example.test");
  await page.getByRole("button", { name: "Submit application", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Application submitted", exact: true })).toBeVisible();
  return page.getByRole("region", { name: "A few quick questions" });
}

async function insightRequests(request: APIRequestContext) {
  const sent = (await (await request.get(`${apiUrl}/__submissions`)).json()) as { path: string; body: unknown }[];
  return sent.filter((entry) => entry.path.startsWith("/api/public/v1/insight_answers/"));
}

const answer = (id: string, value: unknown) => ({
  path: `/api/public/v1/insight_answers/${id}`,
  body: { token: INSIGHT_TOKEN, answer: { value } },
});

test("optional questions save one card at a time, skip without a request and end on what was saved", async ({ page, request, baseURL }) => {
  const bodies: Promise<string>[] = [];
  page.on("response", (response) => {
    if (response.url().startsWith(baseURL!)) bodies.push(response.text().catch(() => ""));
  });

  const deck = await apply(page);
  await expect(deck.getByText("Question 1 of 5")).toBeVisible();

  const cityField = deck.getByRole("textbox", { name: city.prompt });
  await cityField.fill("Gdańsk");
  await cityField.press("Enter");
  await expect(deck.getByRole("heading", { name: onCall.prompt })).toBeFocused();
  await expect(deck.getByRole("status")).toHaveText("Saved.");

  await deck.getByRole("radio", { name: "Yes", exact: true }).click();
  await expect(deck.getByRole("heading", { name: work.prompt })).toBeFocused();

  const link = deck.getByRole("textbox", { name: work.prompt });
  await link.fill("my github");
  await deck.getByRole("button", { name: "Next", exact: true }).click();
  await expect(link).toHaveAccessibleDescription("Use a link that starts with https://.");
  await expect(deck.getByRole("heading", { name: work.prompt })).toBeFocused();
  await expect(link).toHaveValue("my github");

  await deck.getByRole("button", { name: "Skip", exact: true }).click();
  await deck.getByRole("textbox", { name: withdrawn.prompt }).fill("Three months");
  await deck.getByRole("button", { name: "Next", exact: true }).click();
  await expect(deck.getByRole("heading", { name: stack.prompt })).toBeFocused();
  await expect(deck.getByText("Question 4 of 4")).toBeVisible();

  const postgres = deck.getByRole("checkbox", { name: "PostgreSQL", exact: true });
  await postgres.check();
  await postgres.press("Enter");
  await expect(deck.getByRole("heading", { name: stack.prompt })).toBeVisible();
  await deck.getByRole("textbox", { name: "Add your own", exact: true }).fill("Terraform, Kafka Streams");
  await deck.getByRole("button", { name: "Next", exact: true }).click();

  await expect(deck.getByRole("heading", { name: "3 answers saved", exact: true })).toBeFocused();
  await expect(deck.getByText("PostgreSQL, Terraform, Kafka Streams")).toBeVisible();
  await expect(deck.getByText(work.prompt)).toHaveCount(0);
  await expect(deck.getByText(withdrawn.prompt)).toHaveCount(0);

  await deck.getByRole("button", { name: `Change: ${city.prompt}`, exact: true }).click();
  await deck.getByRole("textbox", { name: city.prompt }).fill("Kraków");
  await deck.getByRole("button", { name: "Save", exact: true }).click();
  await expect(deck.getByRole("heading", { name: "3 answers saved", exact: true })).toBeFocused();
  await expect(deck.getByText("Kraków")).toBeVisible();

  expect(await insightRequests(request)).toEqual([
    answer(city.id, "Gdańsk"),
    answer(onCall.id, true),
    answer(work.id, "my github"),
    answer(withdrawn.id, "Three months"),
    answer(stack.id, ["PostgreSQL", "Terraform", "Kafka Streams"]),
    answer(city.id, "Kraków"),
  ]);

  const received = (await Promise.all(bodies)).join("\n");
  expect(received).toContain(stack.prompt);
  expect(received).not.toContain(INSIGHT_TOKEN);
  expect(await page.evaluate(() => document.cookie)).not.toContain(INSIGHT_TOKEN);
});

test("arrow keys only move a choice, and Stop here saves it and ends", async ({ page, request }) => {
  const deck = await apply(page);
  await deck.getByRole("button", { name: "Skip", exact: true }).click();

  await deck.getByRole("radio", { name: "Yes", exact: true }).focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await expect(deck.getByRole("radio", { name: "No", exact: true })).toBeChecked();
  await expect(deck.getByRole("heading", { name: onCall.prompt })).toBeVisible();

  await deck.getByRole("button", { name: "Stop here", exact: true }).click();
  await expect(deck.getByRole("heading", { name: "1 answer saved", exact: true })).toBeFocused();
  expect(await insightRequests(request)).toEqual([answer(onCall.id, false)]);
});

test("review lists what was saved, Change returns to it and the rest stay open", async ({ page, request }) => {
  const deck = await apply(page);
  const cityField = deck.getByRole("textbox", { name: city.prompt });
  await cityField.fill("Gdańsk");
  await cityField.press("Enter");

  await deck.getByRole("button", { name: "1 saved · Review", exact: true }).click();
  await expect(deck.getByRole("heading", { name: "Your saved answers", exact: true })).toBeFocused();
  await expect(deck.getByRole("listitem")).toHaveCount(1);
  await expect(deck.getByRole("listitem")).toContainText("Gdańsk");

  await deck.getByRole("button", { name: `Change: ${city.prompt}`, exact: true }).click();
  await expect(deck.getByText("Changing your answer")).toBeVisible();
  await cityField.fill("Kraków");
  await deck.getByRole("button", { name: "Save", exact: true }).click();
  await expect(deck.getByRole("heading", { name: "Your saved answers", exact: true })).toBeFocused();
  await expect(deck.getByRole("listitem")).toContainText("Kraków");

  await deck.getByRole("button", { name: "4 more you can answer", exact: true }).click();
  await expect(deck.getByRole("heading", { name: onCall.prompt })).toBeFocused();
  await expect(deck.getByText("Question 2 of 5")).toBeVisible();
  expect(await insightRequests(request)).toEqual([answer(city.id, "Gdańsk"), answer(city.id, "Kraków")]);
});

test("closed questions end the deck and leave the application as it is", async ({ page, request }) => {
  const deck = await apply(page);
  await request.post(`${apiUrl}/__insights_closed`);

  await deck.getByRole("textbox", { name: city.prompt }).fill("Gdańsk");
  await deck.getByRole("button", { name: "Next", exact: true }).click();
  await expect(deck.getByRole("heading", { name: "These questions are closed.", exact: true })).toBeFocused();
  await expect(page.getByRole("heading", { name: "Application submitted", exact: true })).toBeVisible();
  expect(await insightRequests(request)).toHaveLength(1);
});

test("an answer token without this site's signature never reaches Kit", async ({ page, context, request, baseURL }) => {
  const deck = await apply(page);
  await context.clearCookies();
  await context.addCookies([{ name: "kit_insights_app_fixture", value: INSIGHT_TOKEN, url: baseURL! }]);

  await deck.getByRole("textbox", { name: city.prompt }).fill("Gdańsk");
  await deck.getByRole("button", { name: "Next", exact: true }).click();
  await expect(deck.getByRole("heading", { name: "These questions are closed.", exact: true })).toBeFocused();
  expect(await insightRequests(request)).toEqual([]);
});
