import assert from "node:assert/strict";
import test from "node:test";
import { jobPostingJsonLd } from "../lib/jsonld.ts";

const base = {
  id: "abc123",
  title: "Platform Engineer",
  department: "Engineering",
  location: "Poznań, Poland",
  employment_type: "full_time",
  remote: false,
  published_at: "2026-10-01T12:00:00Z",
  url: "https://kit.example.test/abc123",
  apply_url: null,
  description_html: "<p>Build things</p>",
  accepting_applications: true,
  stages: [],
  application_form: {},
};

test("structured location fields build the postal address", () => {
  const jsonLd = jobPostingJsonLd({ ...base, city: "Poznań", region: "Greater Poland", country_code: "PL" });

  assert.deepEqual(jsonLd.jobLocation, {
    "@type": "Place",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Poznań",
      addressRegion: "Greater Poland",
      addressCountry: "PL",
    },
  });
});

test("a job without structured fields keeps the free-text locality", () => {
  const jsonLd = jobPostingJsonLd(base);

  assert.deepEqual(jsonLd.jobLocation, {
    "@type": "Place",
    address: { "@type": "PostalAddress", addressLocality: "Poznań, Poland" },
  });
  assert.equal(jsonLd.jobLocationType, undefined);
  assert.equal(jsonLd.applicantLocationRequirements, undefined);
});

test("remote regions become named countries, with EU expanded and de-duplicated", () => {
  const jsonLd = jobPostingJsonLd({ ...base, remote: true, remote_regions: ["PL", "EU", "GB"] });

  assert.equal(jsonLd.jobLocationType, "TELECOMMUTE");
  const names = jsonLd.applicantLocationRequirements.map((entry) => entry.name);
  assert.equal(names.length, 28);
  assert.equal(new Set(names).size, names.length);
  assert.ok(names.includes("Poland"));
  assert.ok(names.includes("Germany"));
  assert.ok(names.includes("United Kingdom"));
  assert.ok(jsonLd.applicantLocationRequirements.every((entry) => entry["@type"] === "Country"));
});

test("a remote job with no regions names no applicant location requirement", () => {
  const jsonLd = jobPostingJsonLd({ ...base, remote: true, remote_regions: [] });

  assert.equal(jsonLd.jobLocationType, "TELECOMMUTE");
  assert.equal(jsonLd.applicantLocationRequirements, undefined);
});
