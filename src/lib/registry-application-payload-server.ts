import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildBrowserApplicationPayloadFromPublication } from "@/lib/registry-application-payload";
import {
  isBrowserApplicationPayloadDocument,
  isPublicationSnapshotDocument,
  isPublicationV2SnapshotDocument,
  type RegistryApplicationsDocument,
} from "@/lib/registry-application-payload-shared";
import {
  isBrowserApplicationPayloadDocumentV2,
  type RegistryApplicationsDocumentV2,
} from "@/lib/registry-applications-document-v2";
import {
  REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION,
  REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION_V20,
} from "@/reveal-day-2026/browser-payload-types";

export const APPLICATION_PAYLOAD_JSON_ENV = "REGISTRY_HUB_APPLICATION_PAYLOAD_JSON";
export const APPLICATION_PAYLOAD_PATH_ENV = "REGISTRY_HUB_APPLICATION_PAYLOAD_PATH";

export const DEFAULT_DRILL_BROWSER_PAYLOAD_PATH =
  "src/data/fixtures/drill-2026-registry-applications.payload.json";

export type LoadedApplicationPayload =
  | { kind: "v1"; document: RegistryApplicationsDocument }
  | { kind: "v2"; document: RegistryApplicationsDocumentV2 };

export function parseApplicationPayloadJson(text: string): RegistryApplicationsDocument {
  const parsed = JSON.parse(text) as unknown;
  if (isBrowserApplicationPayloadDocumentV2(parsed)) {
    throw new Error(
      `${REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION_V20} must be loaded via loadConfiguredApplicationPayloadAny (PATH preferred for ~1.7MB corpus)`,
    );
  }
  if (!isBrowserApplicationPayloadDocument(parsed)) {
    throw new Error(
      `Unsupported application payload document (expected ${REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION})`,
    );
  }
  return parsed;
}

export function parseApplicationPayloadAny(text: string): LoadedApplicationPayload {
  const parsed = JSON.parse(text) as unknown;
  if (isBrowserApplicationPayloadDocumentV2(parsed)) {
    return { kind: "v2", document: parsed };
  }
  if (isBrowserApplicationPayloadDocument(parsed)) {
    return { kind: "v1", document: parsed };
  }
  if (isPublicationV2SnapshotDocument(parsed)) {
    throw new Error(
      "registry-2026-publication/2.0.0 cannot load as an active browser payload (would fabricate 1.1 fields). Generate registry-browser-applications/2.0.0 via build-browser-payload-2x.",
    );
  }
  if (isPublicationSnapshotDocument(parsed)) {
    return { kind: "v1", document: buildBrowserApplicationPayloadFromPublication(parsed) };
  }
  throw new Error(
    `Application payload must be ${REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION}, ${REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION_V20}, or registry-2026-publication/1.1.0 snapshot JSON`,
  );
}

export function loadApplicationPayloadFromEnv(): RegistryApplicationsDocument | null {
  const raw = process.env[APPLICATION_PAYLOAD_JSON_ENV];
  if (!raw?.trim()) return null;
  return parseApplicationPayloadJson(raw);
}

export function loadApplicationPayloadAnyFromEnv(): LoadedApplicationPayload | null {
  const raw = process.env[APPLICATION_PAYLOAD_JSON_ENV];
  if (!raw?.trim()) return null;
  return parseApplicationPayloadAny(raw);
}

async function loadPayloadAnyFromPath(absolutePath: string): Promise<LoadedApplicationPayload> {
  const text = await readFile(absolutePath, "utf8");
  return parseApplicationPayloadAny(text);
}

/**
 * Server-only: configured application payload (env JSON wins over file).
 * Legacy 1.x-only helper — rejects 2.x (use loadConfiguredApplicationPayloadAny).
 */
export async function loadConfiguredApplicationPayload(): Promise<RegistryApplicationsDocument | null> {
  const any = await loadConfiguredApplicationPayloadAny();
  if (!any) return null;
  if (any.kind === "v2") {
    throw new Error(
      `${REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION_V20} is configured — use loadConfiguredApplicationPayloadAny / version-aware hub loader`,
    );
  }
  return any.document;
}

/** Server-only: 1.x or 2.x browser payload (PATH preferred for 2.x production). */
export async function loadConfiguredApplicationPayloadAny(): Promise<LoadedApplicationPayload | null> {
  const fromEnv = loadApplicationPayloadAnyFromEnv();
  if (fromEnv) return fromEnv;

  const configuredPath = process.env[APPLICATION_PAYLOAD_PATH_ENV];
  if (!configuredPath?.trim()) return null;

  const absolute = configuredPath.startsWith("/")
    ? configuredPath
    : join(process.cwd(), configuredPath);
  try {
    return await loadPayloadAnyFromPath(absolute);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `${APPLICATION_PAYLOAD_PATH_ENV} is set but the application payload file could not be read`,
      );
    }
    throw error;
  }
}
