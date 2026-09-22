"use client";

import { useEffect, useRef } from "react";
import { tracker } from "@/lib/kit-tracker";

// Refs guard against StrictMode's development double-invoke of effects,
// which would count every view twice.

export function TrackJobBoardView() {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    tracker.jobBoardViewed();
  }, []);
  return null;
}

export function TrackJobView({ job }: { job: string }) {
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (sent.current === job) return;
    sent.current = job;
    tracker.jobViewed(job);
  }, [job]);
  return null;
}
