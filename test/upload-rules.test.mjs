import assert from "node:assert/strict";
import test from "node:test";
import {
  constraintRefusal,
  FORM_FILE_CONSTRAINTS,
  jobUploadConstraints,
  metadataRefusal,
} from "../lib/upload-rules.ts";

const pdf = {
  filename: "cv.pdf",
  byte_size: 102_400,
  checksum: "1B2M2Y8AsgTpgAmY7PhCfg==",
  content_type: "application/pdf",
};

const form = {
  fields: [
    { name: "portfolio", type: "file", label: "Portfolio", required: false },
    { name: "website", type: "url", label: "Website", required: false },
  ],
  questions: [],
  consent_disclosure_html: "",
  resume: { required: false, content_types: ["application/pdf"], max_byte_size: 10_485_760 },
  turnstile: { required: false, sitekey: null },
};

test("metadata a browser sends passes", () => {
  assert.equal(metadataRefusal(pdf), undefined);
});

test("incomplete or malformed metadata is refused", () => {
  for (const meta of [
    undefined,
    { ...pdf, content_type: "" },
    { ...pdf, byte_size: 0 },
    { ...pdf, byte_size: 1.5 },
    { ...pdf, byte_size: "102400" },
    { ...pdf, checksum: "not-a-base64-md5" },
  ]) {
    assert.equal(metadataRefusal(meta), "metadata", JSON.stringify(meta));
  }
});

test("a filename no browser would send is refused", () => {
  for (const filename of ["", " ", `${"a".repeat(252)}.pdf`, "cv\u0000.pdf", "../cv.pdf", "C:\\cv.pdf"]) {
    assert.equal(metadataRefusal({ ...pdf, filename }), "filename", filename);
  }
});

test("a resume follows the type and size the API publishes for it", () => {
  const constraints = jobUploadConstraints(form, "resume");

  assert.equal(constraintRefusal(pdf, constraints), undefined);
  assert.equal(constraintRefusal({ ...pdf, content_type: "image/png" }, constraints), "content_type");
  assert.equal(constraintRefusal({ ...pdf, byte_size: 10_485_761 }, constraints), "byte_size");
});

test("an extra file field takes Kit's form-file limits", () => {
  const constraints = jobUploadConstraints(form, "portfolio");

  assert.equal(constraintRefusal({ ...pdf, content_type: "image/webp", byte_size: 20_000_000 }, constraints), undefined);
  assert.equal(constraintRefusal({ ...pdf, content_type: "application/zip" }, constraints), "content_type");
  assert.equal(constraintRefusal({ ...pdf, byte_size: FORM_FILE_CONSTRAINTS.max_byte_size + 1 }, constraints), "byte_size");
});

test("a field that is not a file input on the form takes no upload", () => {
  assert.equal(jobUploadConstraints(form, "website"), null);
  assert.equal(jobUploadConstraints(form, "unknown"), null);
});
