export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-14 text-center dark:border-zinc-700 dark:bg-zinc-900">
      <div
        aria-hidden="true"
        className="mx-auto flex size-12 items-center justify-center rounded-full bg-zinc-100 text-xl dark:bg-zinc-800"
      >
        🔍
      </div>
      <h2 className="mt-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
