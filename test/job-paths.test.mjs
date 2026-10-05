import assert from "node:assert/strict";
import test from "node:test";
import { jobPath, jobApplyPath, withJobAttribution } from "../lib/job-paths.ts";

test("job URLs use the public token as one encoded path segment", () => {
  assert.equal(jobPath("abc123"), "/jobs/abc123");
  assert.equal(jobApplyPath("abc123"), "/jobs/abc123/apply");
  assert.equal(jobPath("a/b?#"), "/jobs/a%2Fb%3F%23");
});

test("campaign context survives detail → apply without redirect controls", () => {
  const source = new URLSearchParams("utm_source=board&utm_medium=job+ad&utm_campaign=engineering&utm_term=remote&utm_content=posting&locale=pl&destination=careers&redirect=https://evil.example");
  const href = withJobAttribution(jobApplyPath("abc123"), source);
  assert.equal(href, "/jobs/abc123/apply?utm_source=board&utm_medium=job+ad&utm_campaign=engineering&utm_term=remote&utm_content=posting&locale=pl");
  assert.equal(withJobAttribution(jobPath("abc123"), new URLSearchParams()), "/jobs/abc123");
  assert.equal(withJobAttribution(jobPath("abc123"), new URLSearchParams("utm_source=")), "/jobs/abc123");
});

test("returning to the list or clearing filters retains only campaign context", () => {
  const source = new URLSearchParams("department=Engineering&page=3&remote=true&utm_source=board&locale=de");
  assert.equal(withJobAttribution("/", source), "/?utm_source=board&locale=de");
  assert.equal(withJobAttribution("/careers", source), "/careers?utm_source=board&locale=de");
});
