import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH } from "@/historical-2012/approved-corpus-hash";
import {
  isRegistry2012BrowserPayloadDocument,
  type Historical2012PayloadResolution,
  resolveHistorical2012BrowserPayload,
} from "@/historical-2012/payload-shared";
import type { Registry2012ApplicationsDocument } from "@/historical-2012/browser-payload-document";

export const APPLICATION_PAYLOAD_2012_JSON_ENV = "REGISTRY_HUB_2012_APPLICATION_PAYLOAD_JSON";
export const APPLICATION_PAYLOAD_2012_PATH_ENV = "REGISTRY_HUB_2012_APPLICATION_PAYLOAD_PATH";

export const DEFAULT_REGISTRY_2012_BROWSER_PAYLOAD_PATH =
  "src/data/fixtures/registry-2012-applications.payload.json";

type ExplicitRead<T> =
  | { kind: "absent" }
  | { kind: "document"; document: T }
  | { kind: "invalid"; errorMessage: string };

export function parse2012ApplicationPayloadJson(text: string): Registry2012ApplicationsDocument {
  const parsed = JSON.parse(text) as unknown;
  if (!isRegistry2012BrowserPayloadDocument(parsed)) {
    throw new Error("Unsupported 2012 application payload document");
  }
  return parsed;
}

function readErrorDetail(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown read error";
}

function explicitOverrideRejected(detail: string): string {
  return `Explicit 2012 application payload override was rejected (${detail}). The committed corpus was not substituted.`;
}

export function load2012ApplicationPayloadFromEnv(): Registry2012ApplicationsDocument | null {
  const raw = process.env[APPLICATION_PAYLOAD_2012_JSON_ENV];
  if (!raw?.trim()) return null;
  return parse2012ApplicationPayloadJson(raw);
}

async function loadPayloadFromPath(absolutePath: string): Promise<Registry2012ApplicationsDocument> {
  const text = await readFile(absolutePath, "utf8");
  return parse2012ApplicationPayloadJson(text);
}

function committedApplicationPayloadPath(): string {
  return join(process.cwd(), DEFAULT_REGISTRY_2012_BROWSER_PAYLOAD_PATH);
}

let committedApplicationsPromise: Promise<Registry2012ApplicationsDocument> | undefined;

/** Server-side read of the committed 1,930-row corpus. Not imported into client bundles. */
export function loadCommitted2012ApplicationPayload(): Promise<Registry2012ApplicationsDocument> {
  if (!committedApplicationsPromise) {
    committedApplicationsPromise = loadPayloadFromPath(committedApplicationPayloadPath()).catch((error: unknown) => {
      committedApplicationsPromise = undefined;
      throw error;
    });
  }
  return committedApplicationsPromise;
}

async function readExplicit2012ApplicationPayload(): Promise<ExplicitRead<Registry2012ApplicationsDocument>> {
  const raw = process.env[APPLICATION_PAYLOAD_2012_JSON_ENV];
  if (raw?.trim()) {
    try {
      return { kind: "document", document: parse2012ApplicationPayloadJson(raw) };
    } catch (error) {
      return { kind: "invalid", errorMessage: explicitOverrideRejected(readErrorDetail(error)) };
    }
  }

  const configuredPath = process.env[APPLICATION_PAYLOAD_2012_PATH_ENV];
  if (configuredPath?.trim()) {
    const absolute = configuredPath.startsWith("/")
      ? configuredPath
      : join(process.cwd(), configuredPath);
    try {
      return { kind: "document", document: await loadPayloadFromPath(absolute) };
    } catch (error) {
      return { kind: "invalid", errorMessage: explicitOverrideRejected(readErrorDetail(error)) };
    }
  }

  return { kind: "absent" };
}

/**
 * Configured document only. Null when no override is set or the override was rejected.
 * Does not substitute the committed corpus after an explicit invalid override.
 */
export async function loadConfigured2012ApplicationPayload(): Promise<Registry2012ApplicationsDocument | null> {
  const explicit = await readExplicit2012ApplicationPayload();
  return explicit.kind === "document" ? explicit.document : null;
}

/** Server-only. No override loads the committed corpus. An invalid override fails closed. */
export async function loadHistorical2012PayloadResolution(): Promise<Historical2012PayloadResolution> {
  const explicit = await readExplicit2012ApplicationPayload();
  if (explicit.kind === "invalid") {
    return {
      status: "not-loaded",
      reason: "invalid-document",
      errorMessage: explicit.errorMessage,
    };
  }

  try {
    const document = explicit.kind === "document"
      ? explicit.document
      : await loadCommitted2012ApplicationPayload();
    return resolveHistorical2012BrowserPayload(document, APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH);
  } catch (error) {
    return {
      status: "not-loaded",
      reason: "invalid-document",
      errorMessage: `Committed 2012 application corpus could not be read (${readErrorDetail(error)}).`,
    };
  }
}
