import "server-only";
import { DEFAULT_BASE_URL } from "./kit";
import config from "../next.config";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const previewAssetTypes = {
  logo: IMAGE_TYPES,
  background: IMAGE_TYPES,
  font: ["font/woff2"],
};

type AssetKind = keyof typeof previewAssetTypes;

export function previewAssetPath(kind: AssetKind) {
  return `${config.basePath ?? ""}/preview-assets/${kind}`;
}

export async function fetchPreviewAsset(kind?: AssetKind): Promise<Response | null> {
  const key = process.env.STARTUPKIT_SECRET_KEY;
  if (!key?.startsWith("dp_")) return null;

  const endpoint = `/api/public/v1/prospect_demo_assets${kind ? `/${kind}` : ""}`;
  try {
    const url = new URL(endpoint, process.env.STARTUPKIT_BASE_URL || DEFAULT_BASE_URL);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5_000),
    });
    return response.ok ? response : null;
  } catch {
    return null;
  }
}

export async function fetchPreviewIdentity() {
  const response = await fetchPreviewAsset();
  if (!response) return null;

  try {
    const manifest = await response.json();
    return {
      logo: manifest?.logo === true,
      background: manifest?.background === true,
      font: manifest?.font === true,
    };
  } catch {
    return null;
  }
}
