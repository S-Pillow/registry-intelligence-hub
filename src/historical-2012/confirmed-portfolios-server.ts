import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isRegistry2012ConfirmedPortfoliosDocument } from "@/historical-2012/confirmed-portfolios-sidecar-document";
import {
  resolveConfirmedPortfoliosSidecar,
  type ConfirmedPortfoliosSidecarResolution,
} from "@/historical-2012/confirmed-portfolios-sidecar-shared";
import type { Registry2012ConfirmedPortfoliosDocument } from "@/historical-2012/confirmed-portfolios-sidecar-types";
import {
  APPLICATION_PAYLOAD_2012_JSON_ENV,
  APPLICATION_PAYLOAD_2012_PATH_ENV,
  loadCommitted2012ApplicationPayload,
  loadConfigured2012ApplicationPayload,
} from "@/historical-2012/payload-server";

export const CONFIRMED_PORTFOLIOS_2012_JSON_ENV = "REGISTRY_HUB_2012_CONFIRMED_PORTFOLIOS_JSON";
export const CONFIRMED_PORTFOLIOS_2012_PATH_ENV = "REGISTRY_HUB_2012_CONFIRMED_PORTFOLIOS_PATH";

export const DEFAULT_REGISTRY_2012_CONFIRMED_PORTFOLIOS_PATH =
  "src/data/fixtures/registry-2012-confirmed-organizations.payload.json";

type ExplicitRead<T> =
  | { kind: "absent" }
  | { kind: "document"; document: T }
  | { kind: "invalid"; errorMessage: string };

function readErrorDetail(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown read error";
}

function explicitOverrideRejected(detail: string): string {
  return `Explicit 2012 confirmed portfolio override was rejected (${detail}). The committed sidecar was not substituted.`;
}

export function parse2012ConfirmedPortfoliosJson(text: string): Registry2012ConfirmedPortfoliosDocument {
  const parsed = JSON.parse(text) as unknown;
  if (!isRegistry2012ConfirmedPortfoliosDocument(parsed)) {
    throw new Error("Unsupported 2012 confirmed portfolios sidecar document");
  }
  return parsed;
}

export function load2012ConfirmedPortfoliosFromEnv(): Registry2012ConfirmedPortfoliosDocument | null {
  const raw = process.env[CONFIRMED_PORTFOLIOS_2012_JSON_ENV];
  if (!raw?.trim()) return null;
  return parse2012ConfirmedPortfoliosJson(raw);
}

async function loadSidecarFromPath(absolutePath: string): Promise<Registry2012ConfirmedPortfoliosDocument> {
  const text = await readFile(absolutePath, "utf8");
  return parse2012ConfirmedPortfoliosJson(text);
}

function committedSidecarPath(): string {
  return join(process.cwd(), DEFAULT_REGISTRY_2012_CONFIRMED_PORTFOLIOS_PATH);
}

let committedSidecarPromise: Promise<Registry2012ConfirmedPortfoliosDocument> | undefined;

export function loadCommitted2012ConfirmedPortfoliosSidecar(): Promise<Registry2012ConfirmedPortfoliosDocument> {
  if (!committedSidecarPromise) {
    committedSidecarPromise = loadSidecarFromPath(committedSidecarPath()).catch((error: unknown) => {
      committedSidecarPromise = undefined;
      throw error;
    });
  }
  return committedSidecarPromise;
}

async function readExplicit2012ConfirmedPortfolios(): Promise<ExplicitRead<Registry2012ConfirmedPortfoliosDocument>> {
  const raw = process.env[CONFIRMED_PORTFOLIOS_2012_JSON_ENV];
  if (raw?.trim()) {
    try {
      return { kind: "document", document: parse2012ConfirmedPortfoliosJson(raw) };
    } catch (error) {
      return { kind: "invalid", errorMessage: explicitOverrideRejected(readErrorDetail(error)) };
    }
  }

  const configuredPath = process.env[CONFIRMED_PORTFOLIOS_2012_PATH_ENV];
  if (configuredPath?.trim()) {
    const absolute = configuredPath.startsWith("/")
      ? configuredPath
      : join(process.cwd(), configuredPath);
    try {
      return { kind: "document", document: await loadSidecarFromPath(absolute) };
    } catch (error) {
      return { kind: "invalid", errorMessage: explicitOverrideRejected(readErrorDetail(error)) };
    }
  }

  return { kind: "absent" };
}

export async function loadConfigured2012ConfirmedPortfoliosSidecar(): Promise<Registry2012ConfirmedPortfoliosDocument | null> {
  const explicit = await readExplicit2012ConfirmedPortfolios();
  return explicit.kind === "document" ? explicit.document : null;
}

function applicationOverrideIsExplicit(): boolean {
  return Boolean(
    process.env[APPLICATION_PAYLOAD_2012_JSON_ENV]?.trim()
    || process.env[APPLICATION_PAYLOAD_2012_PATH_ENV]?.trim(),
  );
}

export async function loadHistorical2012ConfirmedPortfoliosResolution(): Promise<ConfirmedPortfoliosSidecarResolution> {
  const explicit = await readExplicit2012ConfirmedPortfolios();
  if (explicit.kind === "invalid") {
    return {
      status: "not-loaded",
      reason: "invalid-document",
      errorMessage: explicit.errorMessage,
    };
  }

  let sidecar: Registry2012ConfirmedPortfoliosDocument;
  try {
    sidecar = explicit.kind === "document"
      ? explicit.document
      : await loadCommitted2012ConfirmedPortfoliosSidecar();
  } catch (error) {
    return {
      status: "not-loaded",
      reason: "invalid-document",
      errorMessage: `Committed 2012 confirmed portfolio sidecar could not be read (${readErrorDetail(error)}).`,
    };
  }

  let basePayload = null;
  if (applicationOverrideIsExplicit()) {
    basePayload = await loadConfigured2012ApplicationPayload();
    if (!basePayload) {
      return {
        status: "not-loaded",
        reason: "base-corpus-hash-mismatch",
        errorMessage:
          "2012 application payload override was rejected, so the confirmed portfolio sidecar was not attached. The committed corpus was not substituted.",
      };
    }
  } else {
    try {
      basePayload = await loadCommitted2012ApplicationPayload();
    } catch (error) {
      return {
        status: "not-loaded",
        reason: "base-corpus-hash-mismatch",
        errorMessage: `Committed 2012 application corpus could not be read (${readErrorDetail(error)}).`,
      };
    }
  }

  return resolveConfirmedPortfoliosSidecar(sidecar, basePayload);
}
