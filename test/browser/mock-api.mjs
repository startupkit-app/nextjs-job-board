import { createServer } from "node:http";

const resume = { required: false, content_types: ["application/pdf"], max_byte_size: 5_000_000 };
const turnstile = { required: false, sitekey: null };
// Job alerts run the quiet widget against the stub in job-alerts.spec.ts; Cloudflare stays unreachable.
const alertTurnstile = { required: true, sitekey: "fixture-sitekey" };
const jobs = [
  { id: "engineering-token", title: "Platform Engineer", department: "Engineering", remote: true },
  { id: "design-token", title: "Product Designer", department: "Product", remote: false },
].map((job) => ({
  ...job,
  location: "Warsaw",
  employment_type: "full_time",
  published_at: "2026-10-01T12:00:00Z",
  url: `https://kit.example.test/${job.id}`,
  description_html: `<p>Join our ${job.department} team.</p>`,
  accepting_applications: true,
  stages: [],
  application_form: { fields: [], questions: [], consent_disclosure_html: "", resume, turnstile },
}));

export const INSIGHT_TOKEN = "insight_fixture_token";
// The employer stopped asking this one after the candidate applied.
const WITHDRAWN = "mfd_Vx2nQe8k";
export const insightQuestions = [
  { id: "mfd_3k9QpL2x", type: "text", prompt: "Which city are you based in?", max_length: 255 },
  { id: "mfd_8Hn2vRt1", type: "boolean", prompt: "Are you open to joining the on-call rotation, one week in six?" },
  { id: "mfd_Qw7cZp4m", type: "url", prompt: "Can you share a link to your work?", placeholder: "https://", max_length: 2048 },
  { id: WITHDRAWN, type: "text", prompt: "What notice period are you on?", max_length: 255 },
  {
    id: "mfd_Lr5tYb9e",
    type: "tags",
    prompt: "Which of these have you run in production?",
    choices: ["Kotlin", "PostgreSQL", "Kafka"],
    max_tags: 10,
    max_length: 50,
  },
];

function insightAnswer(id, payload, state) {
  const reject = (code, message, id) => [422, { error: { code, message, id } }];
  if (state.closed || payload.token !== INSIGHT_TOKEN) return reject("insights_closed", "These questions are closed.");
  const question = insightQuestions.find((item) => item.id === id && item.id !== WITHDRAWN);
  if (!question) return reject("not_askable", "This question isn't asked anymore.", id);
  let value = payload.answer.value;
  if (question.type === "url") {
    if (typeof value !== "string" || !/^\S+\.\S+$/.test(value)) {
      return reject("invalid_url", "Use a link that starts with https://.", question.id);
    }
    if (!/^https?:\/\//.test(value)) value = `https://${value}`;
  }
  state.answers.set(question.id, value);
  return [200, {
    answer: { id: question.id, value, answered_at: "2026-10-05T12:01:00Z" },
    remaining: insightQuestions.length - 1 - state.answers.size,
  }];
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) body += chunk;
  return JSON.parse(body);
}

/** Deterministic server-side SDK responses; no customer keys, network calls or stored candidates. */
export async function startMockApi() {
  const submissions = [];
  const insights = { answers: new Map(), closed: false };
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    const json = (status, data) => {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(data));
    };
    if (url.pathname === "/__submissions") {
      if (request.method === "DELETE") {
        submissions.length = 0;
        insights.answers.clear();
        insights.closed = false;
      }
      json(200, submissions);
      return;
    }
    if (url.pathname === "/__insights_closed") {
      insights.closed = true;
      json(200, {});
      return;
    }
    if (request.headers.authorization !== "Bearer sk_browser_fixture") {
      json(401, { error: { code: "invalid_key", message: "Use the fixture key." } });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/public/v1/jobs") {
      const data = jobs.filter((job) =>
        ["department", "location", "employment_type"].every((key) =>
          !url.searchParams.has(key) || url.searchParams.get(key) === job[key]
        ) && (url.searchParams.get("remote") !== "true" || job.remote)
      );
      json(200, { data, pagination: { current_page: 1, total_pages: 1, total_count: data.length, per_page: 20 } });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/public/v1/talent_pool") {
      json(200, {
        accepting_signups: true,
        fields: [{ name: "email", required: true }],
        resume,
        turnstile,
        consent: { required: true, disclosure_html: "Keep my details for future roles.", retention_months: 12, privacy_policy_url: null },
      });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/public/v1/job_alert_subscriptions") {
      json(200, {
        accepting_subscriptions: true,
        privacy_policy_url: "https://example.test/privacy",
        turnstile: alertTurnstile,
        talent_pool_url: "https://kit.example.test/talent_pool",
      });
      return;
    }
    const token = url.pathname.match(/^\/api\/public\/v1\/jobs\/([^/]+)$/)?.[1];
    const job = jobs.find((item) => item.id === token);
    if (request.method === "GET" && job) {
      json(200, job);
      return;
    }
    const insightId = url.pathname.match(/^\/api\/public\/v1\/insight_answers\/([^/]+)$/)?.[1];
    if (request.method === "PATCH" && insightId) {
      const payload = await readJson(request);
      submissions.push({ path: url.pathname, body: payload });
      json(...insightAnswer(decodeURIComponent(insightId), payload, insights));
      return;
    }
    if (request.method === "POST") {
      const payload = await readJson(request);
      const applicationToken = url.pathname.match(/^\/api\/public\/v1\/jobs\/([^/]+)\/applications$/)?.[1];
      if (jobs.some((item) => item.id === applicationToken)) {
        submissions.push({ path: url.pathname, body: payload });
        json(201, {
          id: "app_fixture",
          status: "submitted",
          job: applicationToken,
          submitted_at: "2026-10-05T12:00:00Z",
          // Only the engineering job asks questions, so the design job keeps the plain success screen.
          ...(applicationToken === "engineering-token" && {
            insights: { token: INSIGHT_TOKEN, expires_at: "2026-10-19T12:00:00Z", questions: insightQuestions },
          }),
        });
        return;
      }
      if (url.pathname === "/api/public/v1/job_alert_subscriptions") {
        if (payload.job_alert_subscription.email === "reject@example.test") {
          json(422, { error: { code: "validation_failed", fields: { email: ["is invalid"] } } });
          return;
        }
        submissions.push({ path: url.pathname, body: payload });
        json(202, { status: "pending_confirmation" });
        return;
      }
      if (url.pathname === "/api/public/v1/talent_pool/entries") {
        submissions.push({ path: url.pathname, body: payload });
        json(201, { id: "tpe_fixture", status: "pending_confirmation" });
        return;
      }
    }
    json(404, { error: { code: "not_found", message: "No fixture at this URL." } });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}
