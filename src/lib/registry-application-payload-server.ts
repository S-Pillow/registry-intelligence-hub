import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildBrowserApplicationPayloadFromPublication } from "@/lib/registry-application-payload";
import {
  isBrowserApplicationPayloadDocument,
  isPublicationSnapshotDocument,
  type RegistryApplicationsDocument,
} from "@/lib/registry-application-payload-shared";
import { REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION } from "@/reveal-day-2026/browser-payload-types";

export const APPLICATION_PAYLOAD_JSON_ENV = "REGISTRY_HUB_APPLICATION_PAYLOAD_JSON";
export const APPLICATION_PAYLOAD_PATH_ENV = "REGISTRY_HUB_APPLICATION_PAYLOAD_PATH";

export const DEFAULT_DRILL_BROWSER_PAYLOAD_PATH =
  "src/data/fixtures/drill-2026-registry-applications.payload.json";

export function parseApplicationPayloadJson(text: string): RegistryApplicationsDocument {
  const parsed = JSON.parse(text) as unknown;
  if (!isBrowserApplicationPayloadDocument(parsed)) {
    throw new Error(
      `Unsupported application payload document (expected ${REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION})`,
    );
  }
  return parsed;
}

export function loadApplicationPayloadFromEnv(): RegistryApplicationsDocument | null {
  const raw = process.env[APPLICATION_PAYLOAD_JSON_ENV];
  if (!raw?.trim()) return null;
  return parseApplicationPayloadJson(raw);
}

async function loadPayloadFromPath(absolutePath: string): Promise<RegistryApplicationsDocument> {
  const text = await readFile(absolutePath, "utf8");
  const parsed = JSON.parse(text) as unknown;
  if (isBrowserApplicationPayloadDocument(parsed)) {
    return parsed;
  }
  if (isPublicationSnapshotDocument(parsed)) {
    return buildBrowserApplicationPayloadFromPublication(parsed);
  }
  throw new Error(
    `Application payload path must be ${REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION} or registry-2026-publication snapshot JSON`,
  );
}

/** Server-only: configured promoted application payload (env JSON wins over file). */
export async function loadConfiguredApplicationPayload(): Promise<RegistryApplicationsDocument | null> {
  const fromEnv = loadApplicationPayloadFromEnv();
  if (fromEnv) return fromEnv;

  const configuredPath = process.env[APPLICATION_PAYLOAD_PATH_ENV];
  if (!configuredPath?.trim()) return null;

  const absolute = configuredPath.startsWith("/")
    ? configuredPath
    : join(process.cwd(), configuredPath);
  return loadPayloadFromPath(absolute);
}
