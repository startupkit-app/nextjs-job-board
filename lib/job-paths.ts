/** SDK job.id is Kit's public token, never the internal database ID or title. */
export function jobPath(token: string): string {
  return `/jobs/${encodeURIComponent(token)}`;
}

export function jobApplyPath(token: string): string {
  return `${jobPath(token)}/apply`;
}

/** Carry campaign attribution to the application without forwarding routing controls. */
export function withJobAttribution(path: string, source: URLSearchParams): string {
  const params = new URLSearchParams();
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "locale"]) {
    const value = source.get(key);
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
