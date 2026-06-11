"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId } from "react";
import { formatEmploymentType } from "@/lib/format";

/**
 * Filter bar driven entirely by URL search params, so filtered views are
 * shareable, crawlable, and survive reloads.
 */
export function JobFilters({
  departments,
  locations,
  employmentTypes,
}: {
  departments: string[];
  locations: string[];
  employmentTypes: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const baseId = useId();

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page"); // filters change the result set — reset pagination
    router.replace(params.size > 0 ? `${pathname}?${params}` : pathname, { scroll: false });
  };

  const hasFilters = ["department", "location", "employment_type", "remote"].some((key) =>
    searchParams.get(key)
  );

  const selectClass =
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-2 focus:outline-indigo-500/30 sm:w-auto dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

  return (
    <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Filter jobs">
      <FilterSelect
        id={`${baseId}-department`}
        label="Department"
        value={searchParams.get("department") ?? ""}
        options={withCurrent(departments, searchParams.get("department"))}
        onChange={(value) => setParam("department", value)}
        className={selectClass}
      />
      <FilterSelect
        id={`${baseId}-location`}
        label="Location"
        value={searchParams.get("location") ?? ""}
        options={withCurrent(locations, searchParams.get("location"))}
        onChange={(value) => setParam("location", value)}
        className={selectClass}
      />
      <FilterSelect
        id={`${baseId}-type`}
        label="Employment type"
        value={searchParams.get("employment_type") ?? ""}
        options={withCurrent(employmentTypes, searchParams.get("employment_type"))}
        onChange={(value) => setParam("employment_type", value)}
        className={selectClass}
        formatLabel={(value) => formatEmploymentType(value) ?? value}
      />

      <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={searchParams.get("remote") === "true"}
          onChange={(event) => setParam("remote", event.target.checked ? "true" : "")}
          className="size-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600"
        />
        Remote only
      </label>

      {hasFilters && (
        <button
          type="button"
          onClick={() => router.replace(pathname, { scroll: false })}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

function withCurrent(options: string[], current: string | null): string[] {
  if (current && !options.includes(current)) return [current, ...options];
  return options;
}

function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
  className,
  formatLabel = (option) => option,
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  className: string;
  formatLabel?: (option: string) => string;
}) {
  if (options.length === 0) return null;

  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={className}
      >
        <option value="">All {label.toLowerCase()}s</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {formatLabel(option)}
          </option>
        ))}
      </select>
    </div>
  );
}
