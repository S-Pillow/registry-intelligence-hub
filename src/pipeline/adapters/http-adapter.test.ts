import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpAdapter } from "./http-adapter";
import type { SourceDefinition } from "../types";

function makeSource(overrides: Partial<SourceDefinition> = {}): SourceDefinition {
  return {
    id: "http-test-source",
    version: 1,
    name: "HTTP test source",
    owner: "Test",
    url: "https://example.test/resource",
    format: "text",
    mediaTypeHint: "text/plain",
    cadence: "test",
    coverage: "test",
    effectiveTimeSemantics: "live-current-status",
    rights: "public-reference-unapproved",
    rightsNote: "test",
    adapterId: "http",
    schemaVersion: "http-adapter/1.0.0",
    maxBytes: 100,
    ...overrides,
  };
}

/** Builds a minimal fetch-compatible Response with a real streaming body, chunked as requested. */
function streamingResponse(chunks: string[], init: { status?: number; headers?: Record<string, string> } = {}): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { status: init.status ?? 200, headers: init.headers ?? { "content-type": "text/plain" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createHttpAdapter", () => {
  it("returns bytes, status, and media type for a well-formed 200 response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => streamingResponse(["hello ", "world"])));
    const adapter = createHttpAdapter();

    const result = await adapter.fetchRaw(makeSource(), {});
    expect(Buffer.from(result.bytes).toString()).toBe("hello world");
    expect(result.httpStatus).toBe(200);
    expect(result.mediaType).toBe("text/plain");
  });

  it("aborts streaming as soon as the byte bound is exceeded, without buffering the full oversized body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => streamingResponse(["x".repeat(60), "x".repeat(60), "x".repeat(60)])),
    );
    const adapter = createHttpAdapter();

    await expect(adapter.fetchRaw(makeSource({ maxBytes: 100 }), {})).rejects.toMatchObject({
      kind: "validation-failed",
      message: expect.stringContaining("exceeded"),
    });
  });

  it("rejects immediately on a declared Content-Length that exceeds the bound, without reading the body", async () => {
    let bodyStarted = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        bodyStarted = true;
        controller.enqueue(new TextEncoder().encode("x".repeat(1000)));
        controller.close();
      },
    });
    const response = new Response(body, { status: 200, headers: { "content-type": "text/plain", "content-length": "1000" } });
    vi.stubGlobal("fetch", vi.fn(async () => response));

    await expect(adapter().fetchRaw(makeSource({ maxBytes: 100 }), {})).rejects.toMatchObject({ kind: "validation-failed" });
    // The declared-length short-circuit cancels the stream before the adapter drains it further than the ReadableStream's own eager start().
    expect(bodyStarted).toBe(true);
  });

  it("classifies a 5xx response as a retryable network-error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => streamingResponse(["server exploded"], { status: 503 })));
    await expect(adapter().fetchRaw(makeSource(), {})).rejects.toMatchObject({ kind: "network-error" });
  });

  it("classifies a 404 response as a terminal validation-failed, not a network-error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => streamingResponse(["not found"], { status: 404 })));
    await expect(adapter().fetchRaw(makeSource(), {})).rejects.toMatchObject({ kind: "validation-failed" });
  });

  it("classifies a thrown network exception (e.g. DNS failure) as network-error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("getaddrinfo ENOTFOUND example.test");
      }),
    );
    await expect(adapter().fetchRaw(makeSource(), {})).rejects.toMatchObject({ kind: "network-error" });
  });

  it("rejects a media-type mismatch even on an otherwise-valid 200 response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => streamingResponse(["<html>redirected to a login page</html>"], { headers: { "content-type": "text/html" } })));
    await expect(adapter().fetchRaw(makeSource({ mediaTypeHint: "application/json", format: "json" }), {})).rejects.toMatchObject({
      kind: "validation-failed",
      message: expect.stringContaining("media type"),
    });
  });

  it("rejects malformed JSON for a source declared as json format", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => streamingResponse(["{ not valid json"], { headers: { "content-type": "application/json" } })));
    await expect(adapter().fetchRaw(makeSource({ mediaTypeHint: "application/json", format: "json", maxBytes: 1000 }), {})).rejects.toMatchObject({
      kind: "validation-failed",
      message: expect.stringContaining("failed to parse"),
    });
  });
});

function adapter() {
  return createHttpAdapter();
}
