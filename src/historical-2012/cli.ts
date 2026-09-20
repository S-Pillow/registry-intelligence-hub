#!/usr/bin/env node
import { parseArgs } from "node:util";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { buildRegistry2012BrowserPayload } from "@/historical-2012/build-browser-payload";

function usage(): string {
  return `Registry Intelligence Hub — 2012 historical browser payload (offline)

Usage:
  npm run historical-2012 -- build-browser-payload [--workspace <dir>] [--out <path>]

Defaults:
  --workspace  process.cwd()
  --out        src/data/fixtures/registry-2012-applications.payload.json
`;
}

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      workspace: { type: "string" },
      out: { type: "string" },
    },
  });

  const [command] = positionals;
  const workspaceRoot = values.workspace ?? process.cwd();

  switch (command) {
    case "build-browser-payload": {
      const payload = await buildRegistry2012BrowserPayload(workspaceRoot);
      const outPath =
        values.out ?? join(workspaceRoot, "src/data/fixtures/registry-2012-applications.payload.json");
      await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`);
      const idn = payload.applications.filter((a) => a.idn).length;
      const uniqueStrings = new Set(payload.applications.map((a) => a.string)).size;
      const inContention = payload.applications.filter((a) => a.contentionSet).length;
      console.log(
        JSON.stringify(
          {
            outPath,
            payloadVersion: payload.payloadVersion,
            snapshotId: payload.snapshotId,
            corpusContentHash: payload.corpusContentHash,
            applications: payload.applications.length,
            uniqueStrings,
            idnApplications: idn,
            contentionMembershipApplications: inContention,
            inputContentHash: payload.provenance.inputContentHash,
          },
          null,
          2,
        ),
      );
      break;
    }
    default:
      console.error(usage());
      process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
