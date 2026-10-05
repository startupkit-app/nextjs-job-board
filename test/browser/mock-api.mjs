import { createServer } from "node:http";

const resume = { required: false, content_types: ["application/pdf"], max_byte_size: 5_000_000 };
const turnstile = { required: false, sitekey: null };
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

/** Deterministic server-side SDK responses; no customer keys, network calls or stored candidates. */
export async function startMockApi() {
  const submissions = [];
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    const json = (status, data) => {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(data));
    };
    if (url.pathname === "/__submissions") {
      if (request.method === "DELETE") submissions.length = 0;
      json(200, submissions);
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
    const token = url.pathname.match(/^\/api\/public\/v1\/jobs\/([^/]+)$/)?.[1];
    const job = jobs.find((item) => item.id === token);
    if (request.method === "GET" && job) {
      json(200, job);
      return;
    }
    if (request.method === "POST") {
      let body = "";
      for await (const chunk of request) body += chunk;
      const payload = JSON.parse(body);
      const applicationToken = url.pathname.match(/^\/api\/public\/v1\/jobs\/([^/]+)\/applications$/)?.[1];
      if (jobs.some((item) => item.id === applicationToken)) {
        submissions.push({ path: url.pathname, body: payload });
        json(201, { id: "app_fixture", status: "submitted", job: applicationToken, submitted_at: "2026-10-05T12:00:00Z" });
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
