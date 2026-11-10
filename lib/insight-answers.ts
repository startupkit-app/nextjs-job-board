/** Drafts, answer values and display text for Kit's optional questions after apply. Client-safe. */

import type { InsightAnswerValue, InsightQuestion } from "./kit";

/** `text` holds the typed value or the picked radio; `picked` holds checked tag suggestions. */
export type InsightDraft = { text: string; picked: string[] };

export const CHOICE_TYPES = new Set<InsightQuestion["type"]>(["boolean", "select", "rating"]);

const SECONDS_PER_TYPE: Record<InsightQuestion["type"], number> = {
  boolean: 5,
  select: 6,
  rating: 6,
  number: 10,
  date: 10,
  text: 15,
  tags: 20,
  url: 20,
  textarea: 60,
};

export function isAnswered(question: InsightQuestion): boolean {
  return question.answer !== undefined;
}

export function estimatedMinutes(questions: InsightQuestion[]): number {
  const seconds = questions
    .filter((question) => !isAnswered(question))
    .reduce((sum, question) => sum + (SECONDS_PER_TYPE[question.type] ?? 15), 0);
  return Math.max(1, Math.round(seconds / 60));
}

export function tagSuggestions(question: InsightQuestion): string[] {
  return question.type === "tags" ? (question.choices ?? []) : [];
}

export function draftFor(question: InsightQuestion): InsightDraft {
  const answer = question.answer;
  if (answer === undefined) return { text: "", picked: [] };
  if (question.type === "tags") {
    const tags = Array.isArray(answer) ? answer : [String(answer)];
    const suggestions = tagSuggestions(question);
    return {
      picked: tags.filter((tag) => suggestions.includes(tag)),
      text: tags.filter((tag) => !suggestions.includes(tag)).join(", "),
    };
  }
  return { text: Array.isArray(answer) ? answer.join(", ") : String(answer), picked: [] };
}

/**
 * The value to send, or `null` when the draft is empty: an empty card is a skip, never a request.
 * Numbers go as typed so Kit, not this site, decides what "1,5" or "abc" means.
 */
export function answerFor(question: InsightQuestion, draft: InsightDraft): InsightAnswerValue | null {
  const text = draft.text.trim();
  switch (question.type) {
    case "tags": {
      const typed = text.split(",").map((tag) => tag.trim()).filter(Boolean);
      const tags = [...draft.picked, ...typed];
      return tags.length > 0 ? tags : null;
    }
    case "boolean":
      return text === "true" ? true : text === "false" ? false : null;
    case "rating":
      return text ? Number(text) : null;
    default:
      return text || null;
  }
}

export function displayAnswer(question: InsightQuestion): string {
  const answer = question.answer;
  if (answer === undefined) return "";
  switch (question.type) {
    case "boolean":
      return answer === true ? "Yes" : "No";
    case "rating":
      return `${answer} of ${question.max ?? 5}`;
    case "date":
      return formatAnswerDate(String(answer));
    default:
      return Array.isArray(answer) ? answer.join(", ") : String(answer);
  }
}

// A calendar date, not an instant: formatted in UTC so no timezone moves it a day.
function formatAnswerDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}
