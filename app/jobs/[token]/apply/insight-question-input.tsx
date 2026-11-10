import { CHOICE_TYPES, tagSuggestions, type InsightDraft } from "@/lib/insight-answers";
import type { InsightQuestion } from "@/lib/kit";

// 16px below `sm`: anything smaller makes iOS zoom the page on focus.
const inputClass =
  "mt-4 block w-full rounded-lg border bg-white px-3 py-2.5 text-base text-zinc-900 placeholder:text-zinc-500 focus:outline-2 focus:outline-indigo-600/40 sm:text-sm dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400";
const tileClass =
  "flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-500 px-3 text-base text-zinc-900 hover:border-indigo-600 has-checked:border-indigo-600 has-checked:bg-indigo-50 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-indigo-600 sm:text-sm dark:text-zinc-100 dark:hover:border-indigo-400 dark:has-checked:border-indigo-400 dark:has-checked:bg-indigo-950";

export function QuestionInput({
  card,
  draft,
  ids,
  onDraft,
  onPick,
  onPointerDown,
}: {
  card: InsightQuestion;
  draft: InsightDraft;
  ids: { heading: string; input: string; hint: string; error?: string };
  onDraft: (next: InsightDraft) => void;
  onPick: (event: React.MouseEvent<HTMLInputElement>, value: string) => void;
  onPointerDown: (event: React.PointerEvent) => void;
}) {
  const invalid = ids.error ? true : undefined;
  const border = ids.error ? "border-red-600 dark:border-red-500" : "border-zinc-500 focus:border-indigo-600";

  if (CHOICE_TYPES.has(card.type)) {
    const max = card.max ?? 5;
    const options: { value: string; text: string; name?: string }[] =
      card.type === "boolean"
        ? [
            { value: "true", text: "Yes" },
            { value: "false", text: "No" },
          ]
        : card.type === "rating"
          ? Array.from({ length: max }, (_, index) => ({
              value: String(index + 1),
              text: String(index + 1),
              name: `${index + 1} of ${max}`,
            }))
          : (card.choices ?? []).map((choice) => ({ value: choice, text: choice }));
    const layout =
      card.type === "boolean"
        ? "grid-cols-2"
        : card.type === "rating"
          ? "grid-cols-[repeat(auto-fit,minmax(3.5rem,1fr))]"
          : "";

    return (
      <fieldset
        role="radiogroup"
        aria-labelledby={ids.heading}
        aria-invalid={invalid}
        onPointerDown={onPointerDown}
        className={`mt-4 grid gap-2 ${layout}`}
      >
        {options.map((option) => (
          <label
            key={option.value}
            className={`${tileClass} min-h-12 py-2.5 ${card.type === "rating" ? "justify-center tabular-nums" : ""}`}
          >
            <input
              type="radio"
              name={ids.input}
              value={option.value}
              checked={draft.text === option.value}
              onChange={() => onDraft({ text: option.value, picked: [] })}
              onClick={(event) => onPick(event, option.value)}
              aria-describedby={ids.error}
              aria-label={option.name}
              className="size-4.5 shrink-0 accent-indigo-600"
            />
            <span aria-hidden={option.name ? true : undefined}>{option.text}</span>
          </label>
        ))}
      </fieldset>
    );
  }

  if (card.type === "textarea") {
    const describedBy = [card.max_length ? ids.hint : undefined, ids.error].filter(Boolean).join(" ") || undefined;
    return (
      <>
        <textarea
          id={ids.input}
          rows={5}
          placeholder={card.placeholder}
          value={draft.text}
          onChange={(event) => onDraft({ ...draft, text: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className={`${inputClass} ${border} min-h-36 resize-y`}
        />
        {card.max_length ? (
          <p id={ids.hint} className="mt-1.5 text-right text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
            {draft.text.length} / {card.max_length}
          </p>
        ) : null}
      </>
    );
  }

  if (card.type === "tags") {
    const suggestions = tagSuggestions(card);
    const limit = card.max_tags ? ` Up to ${card.max_tags}.` : "";
    const describedBy = [ids.hint, ids.error].filter(Boolean).join(" ") || undefined;
    const extra = (
      <input
        id={ids.input}
        type="text"
        autoComplete="off"
        enterKeyHint="next"
        placeholder={card.placeholder}
        value={draft.text}
        onChange={(event) => onDraft({ ...draft, text: event.target.value })}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className={`${inputClass} ${border} min-h-11`}
      />
    );
    const hint = (
      <p id={ids.hint} className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-400">
        {suggestions.length > 0 ? `Pick any that apply, or add your own separated by commas.${limit}` : `Separate them with commas.${limit}`}
      </p>
    );
    if (suggestions.length === 0) {
      return (
        <>
          {extra}
          {hint}
        </>
      );
    }

    return (
      <>
        <fieldset aria-labelledby={ids.heading} className="mt-4 flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <label key={suggestion} className={`${tileClass} min-h-11 py-2`}>
              <input
                type="checkbox"
                value={suggestion}
                checked={draft.picked.includes(suggestion)}
                onChange={(event) =>
                  onDraft({
                    ...draft,
                    picked: event.target.checked
                      ? [...draft.picked, suggestion]
                      : draft.picked.filter((tag) => tag !== suggestion),
                  })
                }
                aria-invalid={invalid}
                aria-describedby={describedBy}
                className="size-4.5 shrink-0 accent-indigo-600"
              />
              <span>{suggestion}</span>
            </label>
          ))}
        </fieldset>
        <label htmlFor={ids.input} className="mt-5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Add your own
        </label>
        {extra}
        {hint}
      </>
    );
  }

  const shared = {
    id: ids.input,
    placeholder: card.placeholder,
    value: draft.text,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => onDraft({ ...draft, text: event.target.value }),
    "aria-invalid": invalid,
    "aria-describedby": ids.error,
    className: `${inputClass} ${border} min-h-11`,
  };
  switch (card.type) {
    case "url":
      return (
        <input {...shared} type="url" inputMode="url" autoComplete="url" autoCapitalize="off" spellCheck={false} enterKeyHint="next" />
      );
    case "date":
      return <input {...shared} type="date" />;
    case "number":
      // Text, not type="number": that drops "1,5" to an empty value instead of letting Kit read it.
      return <input {...shared} type="text" inputMode="decimal" autoComplete="off" enterKeyHint="next" />;
    default:
      return <input {...shared} type="text" autoComplete="off" enterKeyHint="next" />;
  }
}
