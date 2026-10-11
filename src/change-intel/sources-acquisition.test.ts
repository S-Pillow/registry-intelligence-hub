import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { bootstrapChangeIntel } from "@/change-intel/bootstrap";
import { hashContentionMemberships, hashTrackedApplications, sha256Hex } from "@/change-intel/hash";
import { membershipsFromContentionSets } from "@/change-intel/observation";
import { refreshChangeIntel } from "@/change-intel/refresh";
import {
  acquireNormalizedSources,
  APS_APPLICATION_EXPORT_BODY,
  APS_APPLICATION_EXPORT_PATH,
  APS_CONFIG_URL,
  APS_CONTENTION_CSV_URL,
  fetchApplicationCsvBytes,
  fetchContentionCsvBytes,
  locateApplicationExportUrl,
  type FetchLike,
} from "@/change-intel/sources";
import { trackedFieldsFromPublicationApp } from "@/change-intel/tracked-fields";
import { readIndex } from "@/change-intel/state-io";

const FIXTURE_APP = join(
  process.cwd(),
  ".data/reveal-2026/aps-capture/applications.csv",
);
const FIXTURE_CONT = join(
  process.cwd(),
  ".data/reveal-2026/aps-capture/reveal-day-contention-sets.csv",
);

function csvResponse(body: string | Uint8Array, init?: { status?: number; url?: string; type?: string }) {
  const bytes = typeof body === "string" ? Buffer.from(body, "utf8") : Buffer.from(body);
  const response = new Response(bytes, {
    status: init?.status ?? 200,
    headers: { "content-type": init?.type ?? "text/csv;charset=UTF-8" },
  });
  // Node's Response constructor does not accept `url`; define it for redirect tests.
  Object.defineProperty(response, "url", {
    value: init?.url ?? "",
    configurable: true,
  });
  return response;
}

describe("CHANGE-INTEL-1B application source locator / export contract", () => {
  it("locates export URL from official /api/config restBackendUrl", async () => {
    const fetchImpl: FetchLike = async (input) => {
      expect(String(input)).toBe(APS_CONFIG_URL);
      return Response.json({
        restBackendUrl: "https://newgtldprogram-aps.icann.org/aps",
        sortOnPriorityFeature: false,
      });
    };
    const located = await locateApplicationExportUrl(fetchImpl);
    expect(located.exportUrl).toBe(
      `https://newgtldprogram-aps.icann.org/aps${APS_APPLICATION_EXPORT_PATH}`,
    );
  });

  it("POST export returns CSV and rejects 404 HTML", async () => {
    const exportUrl = `https://newgtldprogram-aps.icann.org/aps${APS_APPLICATION_EXPORT_PATH}`;
    const fixture = await readFile(FIXTURE_APP);
    const fetchOk: FetchLike = async (input, init) => {
      expect(String(input)).toBe(exportUrl);
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toEqual(APS_APPLICATION_EXPORT_BODY);
      return csvResponse(fixture, { url: exportUrl });
    };
    const ok = await fetchApplicationCsvBytes({ exportUrl, fetchImpl: fetchOk });
    expect(ok.bytes.byteLength).toBeGreaterThan(1000);
    expect(ok.finalUrl).toBe(exportUrl);

    const fetchHtml: FetchLike = async () =>
      csvResponse("<!DOCTYPE html><html><body>Error</body></html>", {
        status: 404,
        type: "text/html",
        url: exportUrl,
      });
    await expect(fetchApplicationCsvBytes({ exportUrl, fetchImpl: fetchHtml })).rejects.toThrow(
      /APPLICATION_FETCH_FAILED|APPLICATION_NON_CSV_RESPONSE/,
    );
  });

  it("rejects 200 HTML and empty Application responses", async () => {
    const exportUrl = `https://example.test/aps${APS_APPLICATION_EXPORT_PATH}`;
    await expect(
      fetchApplicationCsvBytes({
        exportUrl,
        fetchImpl: async () =>
          csvResponse("<html><body>ok</body></html>", { type: "text/html", url: exportUrl }),
      }),
    ).rejects.toThrow(/APPLICATION_NON_CSV_RESPONSE/);
    await expect(
      fetchApplicationCsvBytes({
        exportUrl,
        fetchImpl: async () => csvResponse("", { type: "text/csv", url: exportUrl }),
      }),
    ).rejects.toThrow(/APPLICATION_NON_CSV_RESPONSE/);
  });

  it("rejects malformed Application CSV via validation", async () => {
    const exportUrl = `https://example.test/aps${APS_APPLICATION_EXPORT_PATH}`;
    const contFixture = await readFile(FIXTURE_CONT);
    await expect(
      acquireNormalizedSources({
        mode: "fetch",
        fetchImpl: async (input) => {
          const url = String(input);
          if (url === APS_CONFIG_URL) {
            return Response.json({ restBackendUrl: "https://example.test/aps" });
          }
          if (url === exportUrl) {
            return csvResponse("not,a,valid,application,csv\n1,2,3,4,5\n", { url: exportUrl });
          }
          if (url === APS_CONTENTION_CSV_URL) {
            return csvResponse(contFixture, { type: "text/csv", url: url });
          }
          throw new Error(`unexpected fetch ${url}`);
        },
      }),
    ).rejects.toThrow(/APPLICATION_VALIDATION_FAILED/);
  });
});

describe("CHANGE-INTEL-1B contention transport", () => {
  it("follows redirect to valid CSV and rejects empty redirect body", async () => {
    const finalUrl =
      "https://newgtldprogram.icann.org/sites/default/files/documents/reveal-day-contention-sets.csv";
    const fixture = await readFile(FIXTURE_CONT);
    const ok = await fetchContentionCsvBytes({
      url: APS_CONTENTION_CSV_URL,
      fetchImpl: async () => csvResponse(fixture, { url: finalUrl, type: "text/csv" }),
    });
    expect(ok.finalUrl).toBe(finalUrl);
    expect(ok.bytes.byteLength).toBeGreaterThan(100);

    await expect(
      fetchContentionCsvBytes({
        url: APS_CONTENTION_CSV_URL,
        fetchImpl: async () =>
          csvResponse("", {
            status: 200,
            url: finalUrl,
            type: "text/html; charset=utf-8",
          }),
      }),
    ).rejects.toThrow(/CONTENTION_NON_CSV_RESPONSE/);
  });

  it("rejects contention HTML bodies", async () => {
    await expect(
      fetchContentionCsvBytes({
        url: APS_CONTENTION_CSV_URL,
        fetchImpl: async () =>
          csvResponse("<!DOCTYPE html><html>nope</html>", {
            type: "text/html",
            url: APS_CONTENTION_CSV_URL,
          }),
      }),
    ).rejects.toThrow(/CONTENTION_NON_CSV_RESPONSE/);
  });

  it("preserves official contention parser scale on fixture", async () => {
    const acquired = await acquireNormalizedSources({
      mode: "file",
      applicationPathOrUrl: FIXTURE_APP,
      contentionPathOrUrl: FIXTURE_CONT,
    });
    expect(acquired.officialContentionSets).toBe(263);
    expect(acquired.officialContentionMemberships).toBe(891);
    expect(acquired.applications.length).toBe(1614);
    expect(acquired.observedDistinctApplicantNames).toBe(480);
  });
});

describe("CHANGE-INTEL-1B hash contract", () => {
  it("raw content hash differs from canonical semantic hash", async () => {
    const acquired = await acquireNormalizedSources({
      mode: "file",
      applicationPathOrUrl: FIXTURE_APP,
      contentionPathOrUrl: FIXTURE_CONT,
    });
    expect(acquired.applicationSource.contentSha256).not.toBe(
      acquired.applicationSource.semanticHash,
    );
    expect(acquired.contentionSource.contentSha256).not.toBe(
      acquired.contentionSource.semanticHash,
    );
    const tracked = acquired.applications.map(trackedFieldsFromPublicationApp);
    expect(acquired.applicationSource.semanticHash).toBe(hashTrackedApplications(tracked));
    const memberships = membershipsFromContentionSets(acquired.contentionSets);
    expect(acquired.contentionSource.semanticHash).toBe(hashContentionMemberships(memberships));
    expect(acquired.applicationSource.contentSha256).toBe(
      createHash("sha256").update(await readFile(FIXTURE_APP)).digest("hex"),
    );
  });

  it("semantic hash is order-independent for applications", async () => {
    const acquired = await acquireNormalizedSources({
      mode: "file",
      applicationPathOrUrl: FIXTURE_APP,
      contentionPathOrUrl: FIXTURE_CONT,
    });
    const tracked = acquired.applications.map(trackedFieldsFromPublicationApp);
    const reversed = [...tracked].reverse();
    expect(hashTrackedApplications(tracked)).toBe(hashTrackedApplications(reversed));
    expect(hashTrackedApplications(tracked)).toBe(acquired.applicationSource.semanticHash);
  });
});

describe("CHANGE-INTEL-1B dry-run / failure state safety", () => {
  async function seededCwd(): Promise<string> {
    const cwd = await mkdtemp(join(tmpdir(), "ci1b-"));
    await mkdir(join(cwd, ".data/reveal-2026/browser"), { recursive: true });
    const boot = await bootstrapChangeIntel({
      cwd,
      browserPayloadPath: join(process.cwd(), ".data/reveal-2026/browser/applications-browser-v2.json"),
    });
    expect(boot.status).toBe("initialized");
    return cwd;
  }

  it("dry-run writes no state", async () => {
    const cwd = await seededCwd();
    const before = await readFile(join(cwd, ".data/change-intel/index.json"), "utf8");
    const result = await refreshChangeIntel({
      cwd,
      dryRun: true,
      mode: "file",
      applicationPathOrUrl: FIXTURE_APP,
      contentionPathOrUrl: FIXTURE_CONT,
    });
    expect(result.wroteState).toBe(false);
    expect(result.status).toBe("dry-run");
    const after = await readFile(join(cwd, ".data/change-intel/index.json"), "utf8");
    expect(after).toBe(before);
  });

  it("acquisition failure writes no state and does not mutate reveal-2026", async () => {
    const cwd = await seededCwd();
    const revealProbe = join(cwd, ".data/reveal-2026/probe.txt");
    await writeFile(revealProbe, "keep\n", "utf8");
    const beforeIdx = await readFile(join(cwd, ".data/change-intel/index.json"), "utf8");
    await expect(
      refreshChangeIntel({
        cwd,
        mode: "file",
        applicationPathOrUrl: join(cwd, "missing-apps.csv"),
        contentionPathOrUrl: FIXTURE_CONT,
      }),
    ).rejects.toThrow(/APPLICATION_FETCH_FAILED|ENOENT|no such file/i);
    const afterIdx = await readFile(join(cwd, ".data/change-intel/index.json"), "utf8");
    expect(afterIdx).toBe(beforeIdx);
    expect(await readFile(revealProbe, "utf8")).toBe("keep\n");
    const index = await readIndex(cwd);
    expect(index?.latestDiffId).toBeNull();
  });
});

describe("CHANGE-INTEL-1B fetch acquire wiring", () => {
  it("uses locator + POST and follows contention redirect via injected fetch", async () => {
    const appFixture = await readFile(FIXTURE_APP);
    const contFixture = await readFile(FIXTURE_CONT);
    const exportUrl = `https://newgtldprogram-aps.icann.org/aps${APS_APPLICATION_EXPORT_PATH}`;
    const finalCont =
      "https://newgtldprogram.icann.org/sites/default/files/documents/reveal-day-contention-sets.csv";
    const fetchImpl: FetchLike = async (input, init) => {
      const url = String(input);
      if (url === APS_CONFIG_URL) {
        return Response.json({ restBackendUrl: "https://newgtldprogram-aps.icann.org/aps" });
      }
      if (url === exportUrl) {
        expect(init?.method).toBe("POST");
        return csvResponse(appFixture, { url: exportUrl });
      }
      if (url === APS_CONTENTION_CSV_URL) {
        expect(init?.method ?? "GET").toBe("GET");
        return csvResponse(contFixture, { url: finalCont, type: "text/csv" });
      }
      throw new Error(`unexpected fetch ${url}`);
    };
    const acquired = await acquireNormalizedSources({ mode: "fetch", fetchImpl });
    expect(acquired.applications.length).toBe(1614);
    expect(acquired.officialContentionMemberships).toBe(891);
    expect(acquired.applicationSource.sourceUrl).toBe(exportUrl);
    expect(acquired.contentionSource.sourceUrl).toBe(finalCont);
    expect(acquired.applicationSource.semanticHash).not.toBe(sha256Hex(appFixture));
  });
});
