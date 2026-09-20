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

export function parse2012ApplicationPayloadJson(text: string): Registry2012ApplicationsDocument {
  const parsed = JSON.parse(text) as unknown;
  if (!isRegistry2012BrowserPayloadDocument(parsed)) {
    throw new Error("Unsupported 2012 application payload document");
  }
  return parsed;
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

/** Server-only: configured 2012 historical payload (env JSON wins over file). No fallback to rehearsal. */
export async function loadConfigured2012ApplicationPayload(): Promise<Registry2012ApplicationsDocument | null> {
  const fromEnv = load2012ApplicationPayloadFromEnv();
  if (fromEnv) return fromEnv;

  const configuredPath = process.env[APPLICATION_PAYLOAD_2012_PATH_ENV];
  if (!configuredPath?.trim()) return null;

  const absolute = configuredPath.startsWith("/")
    ? configuredPath
    : join(process.cwd(), configuredPath);
  return loadPayloadFromPath(absolute);
}

export async function loadHistorical2012PayloadResolution(): Promise<Historical2012PayloadResolution> {
  const configured = await loadConfigured2012ApplicationPayload();
  return resolveHistorical2012BrowserPayload(configured, APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH);
}
