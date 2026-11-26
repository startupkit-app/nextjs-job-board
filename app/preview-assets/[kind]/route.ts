import { fetchPreviewAsset, previewAssetTypes } from "@/lib/preview-assets";
import { previewMode } from "@/lib/preview";

const previewHeaders = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(_request: Request, { params }: { params: Promise<{ kind: string }> }) {
  if (!previewMode) return new Response(null, { status: 404 });

  const { kind } = await params;
  if (!Object.hasOwn(previewAssetTypes, kind)) return new Response(null, { status: 404, headers: previewHeaders });

  const assetKind = kind as keyof typeof previewAssetTypes;
  const asset = await fetchPreviewAsset(assetKind);
  const contentType = asset?.headers.get("content-type")?.split(";")[0] ?? "";
  if (!asset || !previewAssetTypes[assetKind].includes(contentType)) {
    return new Response(null, { status: 404, headers: previewHeaders });
  }

  return new Response(asset.body, {
    headers: { ...previewHeaders, "Content-Type": contentType },
  });
}
