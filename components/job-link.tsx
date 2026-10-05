"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { withJobAttribution } from "@/lib/job-paths";

type Props = { href: string; className?: string; children: React.ReactNode };

/** Keep static job pages cacheable; campaign query strings are read in the browser. */
export function JobLink(props: Props) {
  return (
    <Suspense fallback={<Link {...props} />}>
      <AttributedJobLink {...props} />
    </Suspense>
  );
}

function AttributedJobLink({ href, ...props }: Props) {
  const searchParams = useSearchParams();
  return <Link {...props} href={withJobAttribution(href, new URLSearchParams(searchParams))} />;
}
