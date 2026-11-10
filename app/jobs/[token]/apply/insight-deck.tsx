"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatDate } from "@/lib/format";
import {
  answerFor,
  CHOICE_TYPES,
  displayAnswer,
  draftFor,
  estimatedMinutes,
  isAnswered,
  tagSuggestions,
  type InsightDraft,
} from "@/lib/insight-answers";
import type { InsightAnswerValue, InsightQuestion } from "@/lib/kit";
import { INSIGHT_SAVE_FAILED_MESSAGE } from "@/lib/kit-errors";
import { answerInsight, type DeckInsights, type InsightAnswerState } from "./actions";
import { QuestionInput } from "./insight-question-input";

const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME;
const hiringTeam = companyName ? `${companyName}'s hiring team` : "the hiring team";
const EMPTY_DRAFT: InsightDraft = { text: "", picked: [] };

type Screen =
  | { kind: "question"; index: number; returnTo?: "done" | "review" }
  | { kind: "review" }
  | { kind: "done" }
  | { kind: "closed" };

type DeckState = {
  cards: InsightQuestion[];
  screen: Screen;
  draft: InsightDraft;
  error: string | null;
  notice: string | null;
};

const DONE: Screen = { kind: "done" };

function openFrom(cards: InsightQuestion[], start: number): Screen {
  const index = cards.findIndex((card, position) => position >= start && !isAnswered(card));
  return index === -1 ? DONE : { kind: "question", index };
}

function show(cards: InsightQuestion[], screen: Screen, notice: string | null = null): DeckState {
  const draft = screen.kind === "question" ? draftFor(cards[screen.index]) : EMPTY_DRAFT;
  return { cards, screen, draft, error: null, notice };
}

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-wait disabled:opacity-60";
const ghostColors = "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800";
const primaryButton = `${buttonBase} px-4 text-sm bg-indigo-600 text-white hover:bg-indigo-500`;
const ghostButton = `${buttonBase} px-4 text-sm ${ghostColors}`;
const compactButton = `${buttonBase} px-3 ${ghostColors}`;
const cardClass =
  "flex flex-col rounded-xl border border-zinc-200 bg-white motion-safe:animate-deck-enter dark:border-zinc-800 dark:bg-zinc-900";
const headingClass =
  "rounded-sm text-lg font-semibold leading-snug text-pretty text-zinc-900 focus:outline-2 focus:outline-offset-4 focus:outline-indigo-600 dark:text-zinc-100 dark:focus:outline-indigo-400";

/** Kit's optional questions after apply, one card at a time. Skips never reach Kit. */
export function InsightDeck({ applicationId, insights }: { applicationId: string; insights: DeckInsights }) {
  const uid = useId();
  const [deck, setDeck] = useState(() => show(insights.questions, openFrom(insights.questions, 0)));
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [focusRequest, setFocusRequest] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pressedAt = useRef(0);
  const inFlight = useRef(false);
  const announceTimer = useRef<number | undefined>(undefined);

  const { cards, screen, draft, error, notice } = deck;
  const savedCount = cards.filter(isAnswered).length;
  const deadline = formatDate(insights.expires_at);

  useEffect(() => {
    if (focusRequest) headingRef.current?.focus();
  }, [focusRequest]);

  useEffect(() => {
    const timer = announceTimer;
    return () => window.clearTimeout(timer.current);
  }, []);

  // Cleared first so the same message twice in a row is still read out.
  function announce(message: string) {
    setAnnouncement("");
    window.clearTimeout(announceTimer.current);
    announceTimer.current = window.setTimeout(() => setAnnouncement(message), 100);
  }

  function go(next: DeckState, message?: string) {
    setDeck(next);
    setFailure("");
    setFocusRequest((count) => count + 1);
    if (message) announce(message);
  }

  async function submit(current: InsightDraft, stop: boolean) {
    if (inFlight.current || screen.kind !== "question") return;
    const { index, returnTo } = screen;
    const card = cards[index];
    const value = answerFor(card, current);
    const leave = (onward: Screen): Screen => (stop ? DONE : returnTo ? { kind: returnTo } : onward);

    if (value === null) {
      go(show(cards, leave(openFrom(cards, index + 1))));
      return;
    }

    inFlight.current = true;
    setPending(true);
    setFailure("");
    let result: InsightAnswerState;
    try {
      result = await answerInsight(applicationId, card.id, value);
    } catch {
      result = { status: "failed", message: INSIGHT_SAVE_FAILED_MESSAGE };
    }
    inFlight.current = false;
    setPending(false);

    switch (result.status) {
      case "saved": {
        const saved: InsightAnswerValue = result.value;
        const next = cards.map((item) => (item.id === card.id ? { ...item, answer: saved } : item));
        const savedAs = card.type === "url" && saved !== value ? `Saved as ${saved}` : null;
        const onward = result.remaining === 0 ? DONE : openFrom(next, index + 1);
        go(show(next, leave(onward), savedAs), savedAs ? `${savedAs}.` : "Saved.");
        return;
      }
      case "invalid": {
        if (stop) {
          go(show(cards, DONE));
          return;
        }
        setDeck((previous) => ({ ...previous, error: result.message, notice: null }));
        setFocusRequest((count) => count + 1);
        announce(result.message);
        return;
      }
      case "not_askable": {
        const next = cards.filter((item) => item.id !== card.id);
        go(show(next, leave(openFrom(next, index))));
        return;
      }
      case "closed":
        go(show(cards, { kind: "closed" }));
        return;
      case "failed":
        setFailure(result.message);
        setFocusRequest((count) => count + 1);
        return;
    }
  }

  function setDraft(next: InsightDraft) {
    setDeck((previous) => ({ ...previous, draft: next }));
  }

  // Arrow keys move through a radio group, so only a pointer pick saves and advances.
  function pick(event: React.MouseEvent<HTMLInputElement>, value: string) {
    if (!pressedAt.current || event.timeStamp - pressedAt.current > 1000) return;
    pressedAt.current = 0;
    const next = { text: value, picked: [] };
    setDraft(next);
    void submit(next, false);
  }

  let body: React.ReactNode;
  if (screen.kind === "question") {
    const { index, returnTo } = screen;
    const card = cards[index];
    const ids = {
      heading: `${uid}-heading`,
      counter: `${uid}-counter`,
      input: `${uid}-input`,
      hint: `${uid}-hint`,
      error: error ? `${uid}-error` : undefined,
    };
    const promptIsLabel = !CHOICE_TYPES.has(card.type) && tagSuggestions(card).length === 0;

    body = (
      <form
        key={`${card.id}:${returnTo ?? ""}`}
        noValidate
        aria-labelledby={ids.heading}
        onSubmit={(event) => {
          event.preventDefault();
          void submit(draft, false);
        }}
        onKeyDown={(event) => {
          // Browsers submit on Enter in a checkbox, which would save the tags ticked so far.
          if (event.key === "Enter" && event.target instanceof HTMLInputElement && event.target.type === "checkbox") {
            event.preventDefault();
          }
        }}
        className={cardClass}
      >
        <div className="flex min-h-11 items-center gap-1 rounded-t-xl bg-zinc-50 px-2 sm:px-3 dark:bg-zinc-800/50">
          {returnTo ? (
            <span id={ids.counter} className="flex-1 px-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Changing your answer
            </span>
          ) : (
            <>
              {index > 0 && (
                <button
                  type="button"
                  aria-label="Previous question"
                  disabled={pending}
                  onClick={() => go(show(cards, { kind: "question", index: index - 1 }))}
                  className={`${compactButton} text-sm`}
                >
                  <span aria-hidden="true">←</span>
                </button>
              )}
              <span id={ids.counter} className="flex-1 px-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Question {index + 1} of {cards.length}
              </span>
              {savedCount > 0 && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => go(show(cards, { kind: "review" }))}
                  className={`${compactButton} text-xs`}
                >
                  {savedCount} saved · Review
                </button>
              )}
            </>
          )}
        </div>
        <Meter cards={cards} current={index} />

        <div className="p-4 sm:p-6">
          {notice && <Notice text={notice} />}
          <h3 ref={headingRef} id={ids.heading} tabIndex={-1} aria-describedby={ids.counter} className={headingClass}>
            {promptIsLabel ? <label htmlFor={ids.input}>{card.prompt}</label> : <span>{card.prompt}</span>}
          </h3>
          <QuestionInput
            card={card}
            draft={draft}
            ids={ids}
            onDraft={setDraft}
            onPick={pick}
            onPointerDown={(event) => {
              pressedAt.current = event.timeStamp;
            }}
          />
          {error && (
            <p id={ids.error} className="mt-2 text-sm font-medium text-red-700 dark:text-red-400">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 rounded-b-xl border-t border-zinc-200 bg-white px-3 py-2 sm:px-4 sm:py-3 max-sm:sticky max-sm:bottom-0 max-sm:z-10 max-sm:pb-[max(0.5rem,env(safe-area-inset-bottom))] dark:border-zinc-800 dark:bg-zinc-900">
          {returnTo ? (
            <>
              <button type="button" disabled={pending} onClick={() => go(show(cards, { kind: returnTo }))} className={ghostButton}>
                Cancel
              </button>
              <button type="submit" disabled={pending} className={`${primaryButton} ml-auto max-sm:flex-1`}>
                Save
              </button>
            </>
          ) : (
            <>
              <button type="button" disabled={pending} onClick={() => void submit(draft, true)} className={ghostButton}>
                Stop here
              </button>
              <div className="ml-auto flex gap-2 max-sm:flex-1 max-sm:justify-end">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => go(show(cards, openFrom(cards, index + 1)))}
                  className={ghostButton}
                >
                  Skip
                </button>
                <button type="submit" disabled={pending} className={`${primaryButton} max-sm:flex-1`}>
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      </form>
    );
  } else if (screen.kind === "closed") {
    body = (
      <section key="closed" aria-labelledby={`${uid}-end`} className={cardClass}>
        <div className="p-4 sm:p-6">
          <h3 ref={headingRef} id={`${uid}-end`} tabIndex={-1} className={headingClass}>
            These questions are closed.
          </h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Your application is complete as it is.</p>
        </div>
      </section>
    );
  } else {
    const review = screen.kind === "review";
    const openCount = cards.length - savedCount;
    body = (
      <section key={screen.kind} aria-labelledby={`${uid}-end`} className={cardClass}>
        {savedCount > 0 && <Meter cards={cards} className="overflow-hidden rounded-t-[11px]" />}
        <div className="p-4 sm:p-6">
          {!review && savedCount > 0 && (
            <span aria-hidden="true" className="mb-3 flex size-8 items-center justify-center rounded-full bg-emerald-600 text-white">
              ✓
            </span>
          )}
          <h3 ref={headingRef} id={`${uid}-end`} tabIndex={-1} className={headingClass}>
            {review
              ? "Your saved answers"
              : savedCount > 0
                ? `${savedCount} ${savedCount === 1 ? "answer" : "answers"} saved`
                : "No details added."}
          </h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {review
              ? `You can change them until ${deadline}.`
              : savedCount > 0
                ? `Only ${hiringTeam} sees them. You can change them until ${deadline}.`
                : "Your application is complete as it is."}
          </p>
          {notice && <Notice text={notice} />}
          {savedCount > 0 && (
            <ul role="list" className="-mx-4 mt-5 divide-y divide-zinc-200 border-t border-zinc-200 sm:-mx-6 dark:divide-zinc-800 dark:border-zinc-800">
              {cards.map((card, index) =>
                isAnswered(card) ? (
                  <li key={card.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-4 py-3 sm:px-6">
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">{card.prompt}</span>
                    <span className="col-start-1 line-clamp-2 text-sm text-zinc-900 [overflow-wrap:anywhere] dark:text-zinc-100">
                      {displayAnswer(card)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Change: ${card.prompt}`}
                      onClick={() => go(show(cards, { kind: "question", index, returnTo: review ? "review" : "done" }))}
                      className={`${compactButton} col-start-2 row-span-2 row-start-1 border border-zinc-300 text-sm dark:border-zinc-700`}
                    >
                      Change
                    </button>
                  </li>
                ) : null
              )}
            </ul>
          )}
        </div>
        {review && openCount > 0 && (
          <div className="flex rounded-b-xl border-t border-zinc-200 px-3 py-2 sm:px-4 sm:py-3 dark:border-zinc-800">
            <button type="button" onClick={() => go(show(cards, openFrom(cards, 0)))} className={`${primaryButton} ml-auto`}>
              {openCount} more you can answer <span aria-hidden="true">→</span>
            </button>
          </div>
        )}
      </section>
    );
  }

  const plates =
    screen.kind === "question" && !screen.returnTo
      ? Math.min(2, cards.slice(screen.index + 1).filter((card) => !isAnswered(card)).length)
      : 0;
  const minutes = estimatedMinutes(cards);

  return (
    <section aria-labelledby={`${uid}-title`} className="mt-10">
      <h2 id={`${uid}-title`} className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        A few quick questions
      </h2>
      {screen.kind === "question" && (
        <p className="mt-1 max-w-prose text-sm leading-6 text-pretty text-zinc-600 dark:text-zinc-400">
          Optional, about {minutes} {minutes === 1 ? "minute" : "minutes"}. Only {hiringTeam} sees your
          answers. You can change them until {deadline}.
        </p>
      )}
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <p role="alert" className={failure ? "mt-3 text-sm font-medium text-red-700 dark:text-red-400" : undefined}>
        {failure}
      </p>

      <div className="relative mt-4 pb-4">
        <div
          aria-hidden="true"
          className={`absolute inset-x-6 top-4 bottom-0 rounded-xl border border-zinc-200 bg-zinc-100 transition-opacity motion-reduce:transition-none dark:border-zinc-800 dark:bg-zinc-900 ${plates >= 2 ? "opacity-100" : "opacity-0"}`}
        />
        <div
          aria-hidden="true"
          className={`absolute inset-x-3 top-2 bottom-2 rounded-xl border border-zinc-200 bg-zinc-50 transition-opacity motion-reduce:transition-none dark:border-zinc-800 dark:bg-zinc-900 ${plates >= 1 ? "opacity-100" : "opacity-0"}`}
        />
        <div className="relative z-10">{body}</div>
      </div>
    </section>
  );
}

function Meter({ cards, current, className = "" }: { cards: InsightQuestion[]; current?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={`grid h-[3px] auto-cols-fr grid-flow-col gap-0.5 ${className}`}>
      {cards.map((card, index) => (
        <span
          key={card.id}
          className={
            index === current
              ? "bg-zinc-900 dark:bg-zinc-100"
              : isAnswered(card)
                ? "bg-indigo-600 dark:bg-indigo-400"
                : "bg-zinc-200 dark:bg-zinc-700"
          }
        />
      ))}
    </div>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <p className="my-3 flex items-start gap-2 text-sm text-zinc-700 [overflow-wrap:anywhere] first:mt-0 dark:text-zinc-300">
      <span aria-hidden="true" className="text-emerald-600 dark:text-emerald-400">
        ✓
      </span>
      <span>{text}</span>
    </p>
  );
}
