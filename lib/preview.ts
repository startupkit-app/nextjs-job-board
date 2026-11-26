export const previewKeyConfigured = process.env.STARTUPKIT_SECRET_KEY?.startsWith("dp_") ?? false;
export const previewMode = previewKeyConfigured || process.env.STARTUPKIT_PREVIEW_MODE === "1";
