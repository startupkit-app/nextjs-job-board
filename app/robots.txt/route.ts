import { previewMode } from "@/lib/preview";

export function GET() {
  if (!previewMode) return new Response(null, { status: 404 });

  // Allow crawling so search engines can read the noindex response directive.
  return new Response("User-agent: *\nAllow: /\n", {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
