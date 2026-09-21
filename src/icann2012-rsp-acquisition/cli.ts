#!/usr/bin/env node
import { parseArgs } from "node:util";
import { acquirePilotPortions, formatDryRunReport, isAcquisitionAuthorized } from "./acquire";
import { formatMappingDryRun, runMappingDryRun } from "./mapping-dry-run";
import { RSP_ACQUISITION_AUTH_ENV } from "./constants";

function usage(): string {
  return `ICANN 2012 RSP public portions acquisition (offline-first)

Usage:
  npm run acquire-rsp-portions -- pilot [--workspace <dir>] [--staging <dir>]
  npm run acquire-rsp-portions -- mapping-dry-run [--workspace <dir>] [--grid-html <path>] [--mapping-csv <path>]

Environment:
  ${RSP_ACQUISITION_AUTH_ENV}=1  Required for live HTTP (not used in CI/tests). Default is dry-run only.

Examples:
  npm run acquire-rsp-portions -- pilot
  REGISTRY_HUB_RSP_ACQUISITION_AUTHORIZED=1 npm run acquire-rsp-portions -- pilot --staging /tmp/rsp-staging
`;
}

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      workspace: { type: "string", default: process.cwd() },
      staging: { type: "string" },
      "grid-html": { type: "string" },
      "mapping-csv": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help || positionals.length === 0) {
    console.log(usage());
    process.exit(0);
  }

  const command = positionals[0];
  const workspaceRoot = values.workspace as string;

  if (command === "pilot") {
    const result = await acquirePilotPortions({
      workspaceRoot,
      stagingRoot: values.staging as string | undefined,
    });
    if (result.mode === "dry-run") {
      console.log(formatDryRunReport(result));
      if (isAcquisitionAuthorized()) {
        console.error("Unexpected dry-run while authorized — aborting");
        process.exit(1);
      }
      return;
    }
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "mapping-dry-run") {
    const result = await runMappingDryRun({
      workspaceRoot,
      gridHtmlPath: values["grid-html"] as string | undefined,
      mappingCsvPath: values["mapping-csv"] as string | undefined,
    });
    console.log(formatMappingDryRun(result));
    return;
  }

  console.error(`Unknown command: ${command}\n\n${usage()}`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
