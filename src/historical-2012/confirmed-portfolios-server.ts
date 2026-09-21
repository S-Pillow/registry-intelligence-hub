import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isRegistry2012ConfirmedPortfoliosDocument } from "@/historical-2012/confirmed-portfolios-sidecar-document";
import {
  resolveConfirmedPortfoliosSidecar,
  type ConfirmedPortfoliosSidecarResolution,
} from "@/historical-2012/confirmed-portfolios-sidecar-shared";
import type { Registry2012ConfirmedPortfoliosDocument } from "@/historical-2012/confirmed-portfolios-sidecar-types";
import { loadConfigured2012ApplicationPayload } from "@/historical-2012/payload-server";

export const CONFIRMED_PORTFOLIOS_2012_JSON_ENV = "REGISTRY_HUB_2012_CONFIRMED_PORTFOLIOS_JSON";
export const CONFIRMED_PORTFOLIOS_2012_PATH_ENV = "REGISTRY_HUB_2012_CONFIRMED_PORTFOLIOS_PATH";

export const DEFAULT_REGISTRY_2012_CONFIRMED_PORTFOLIOS_PATH =
  "src/data/fixtures/registry-2012-confirmed-organizations.payload.json";

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

export async function loadConfigured2012ConfirmedPortfoliosSidecar(): Promise<Registry2012ConfirmedPortfoliosDocument | null> {
  const fromEnv = load2012ConfirmedPortfoliosFromEnv();
  if (fromEnv) return fromEnv;

  const configuredPath = process.env[CONFIRMED_PORTFOLIOS_2012_PATH_ENV];
  if (!configuredPath?.trim()) return null;

  const absolute = configuredPath.startsWith("/")
    ? configuredPath
    : join(process.cwd(), configuredPath);
  return loadSidecarFromPath(absolute);
}

export async function loadHistorical2012ConfirmedPortfoliosResolution(): Promise<ConfirmedPortfoliosSidecarResolution> {
  const [basePayload, sidecar] = await Promise.all([
    loadConfigured2012ApplicationPayload(),
    loadConfigured2012ConfirmedPortfoliosSidecar(),
  ]);
  return resolveConfirmedPortfoliosSidecar(sidecar, basePayload);
}
