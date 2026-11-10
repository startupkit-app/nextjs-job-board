import assert from "node:assert/strict";
import test from "node:test";
import { answerFor, displayAnswer, draftFor, estimatedMinutes } from "../lib/insight-answers.ts";

const question = (type, extra = {}) => ({ id: "mfd_x", type, prompt: "?", ...extra });
const draft = (text, picked = []) => ({ text, picked });

test("an empty or blank draft is a skip, never a value to send", () => {
  for (const type of ["text", "textarea", "number", "date", "url", "select", "boolean", "rating", "tags"]) {
    assert.equal(answerFor(question(type), draft("   ")), null, type);
  }
  assert.equal(answerFor(question("tags"), draft(" , ,")), null);
});

test("values go out in the shape each type expects, numbers as typed", () => {
  assert.equal(answerFor(question("text"), draft("  Kraków ")), "Kraków");
  assert.equal(answerFor(question("number"), draft("1,5")), "1,5");
  assert.equal(answerFor(question("number"), draft("abc")), "abc");
  assert.equal(answerFor(question("boolean"), draft("false")), false);
  assert.equal(answerFor(question("rating", { max: 5 }), draft("4")), 4);
  assert.equal(answerFor(question("date"), draft("2026-03-01")), "2026-03-01");
});

test("tags send checked suggestions first, then each typed extra", () => {
  const tags = question("tags", { choices: ["Kotlin", "Kafka"] });
  assert.deepEqual(answerFor(tags, draft(" Terraform,, Kafka Streams ", ["Kafka"])), ["Kafka", "Terraform", "Kafka Streams"]);
  assert.deepEqual(answerFor(question("tags"), draft("Go")), ["Go"]);
});

test("a saved answer reopens as the draft it came from", () => {
  const tags = question("tags", { choices: ["Kotlin", "Kafka"], answer: ["Kafka", "Terraform"] });
  assert.deepEqual(draftFor(tags), draft("Terraform", ["Kafka"]));
  assert.deepEqual(answerFor(tags, draftFor(tags)), ["Kafka", "Terraform"]);
  assert.deepEqual(draftFor(question("boolean", { answer: true })), draft("true"));
  assert.deepEqual(draftFor(question("number", { answer: 20000 })), draft("20000"));
  assert.deepEqual(draftFor(question("text")), draft(""));
});

test("saved answers read as people say them", () => {
  assert.equal(displayAnswer(question("boolean", { answer: false })), "No");
  assert.equal(displayAnswer(question("rating", { answer: 4, max: 5 })), "4 of 5");
  assert.equal(displayAnswer(question("tags", { answer: ["Go", "Rust"] })), "Go, Rust");
  assert.equal(displayAnswer(question("date", { answer: "2026-03-01" })), "Mar 1, 2026");
});

test("the time estimate counts only what is still unanswered", () => {
  const cards = [question("textarea"), question("textarea"), question("boolean", { answer: true })];
  assert.equal(estimatedMinutes(cards), 2);
  assert.equal(estimatedMinutes([question("boolean")]), 1);
});
