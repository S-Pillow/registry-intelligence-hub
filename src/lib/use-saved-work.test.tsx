// @vitest-environment happy-dom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useSavedWork } from "./use-saved-work";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("useSavedWork — Briefing Definition + Edition lifecycle", () => {
  it("creates a Definition with its first Draft Edition, immutable scope/audience recipe fields", async () => {
    const { result } = renderHook(() => useSavedWork());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    let created!: ReturnType<typeof result.current.createBriefing>;
    act(() => {
      created = result.current.createBriefing({
        name: "Round-wide briefing",
        entryPath: "instant",
        audience: "executive",
        sectionsWanted: ["headline-metrics", "what-stands-out", "limitations"],
        scope: { kind: "round-wide" },
      });
    });

    expect(result.current.briefingDefinitions).toHaveLength(1);
    expect(result.current.briefingDefinitions[0].name).toBe("Round-wide briefing");
    expect(result.current.briefingDefinitions[0].emphasis).toBe("all");
    expect(result.current.briefingDefinitions[0].detailLevel).toBe("brief");
    expect(result.current.briefingEditions).toHaveLength(1);
    expect(created.edition.status).toBe("draft");
    expect(created.edition.sections.length).toBeGreaterThan(0);
  });

  it("update-to-current creates a new edition and marks the prior one superseded, never mutating it", async () => {
    const { result } = renderHook(() => useSavedWork());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    let created!: ReturnType<typeof result.current.createBriefing>;
    act(() => {
      created = result.current.createBriefing({ name: "Test", entryPath: "instant", audience: "executive", sectionsWanted: ["headline-metrics", "limitations"], scope: { kind: "round-wide" } });
    });
    const firstEditionId = created.edition.id;

    act(() => {
      result.current.updateBriefingToCurrent(created.definition.id);
    });

    expect(result.current.briefingEditions).toHaveLength(2);
    const first = result.current.briefingEditions.find((edition) => edition.id === firstEditionId)!;
    expect(first.status).toBe("superseded");
    expect(first.sections).toEqual(created.edition.sections);

    const definition = result.current.briefingDefinitions.find((entry) => entry.id === created.definition.id)!;
    expect(definition.currentEditionId).not.toBe(firstEditionId);
    const current = result.current.briefingEditions.find((edition) => edition.id === definition.currentEditionId)!;
    expect(current.status).toBe("draft");
    expect(first.supersededByEditionId).toBe(current.id);
  });

  it("finalize locks an edition; further edit/toggle/add-claim/update-to-current-generated-edit attempts on it are no-ops", async () => {
    const { result } = renderHook(() => useSavedWork());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    let created!: ReturnType<typeof result.current.createBriefing>;
    act(() => {
      created = result.current.createBriefing({ name: "Test", entryPath: "instant", audience: "executive", sectionsWanted: ["headline-metrics", "limitations"], scope: { kind: "round-wide" } });
    });
    const editionId = created.edition.id;
    const claim = created.edition.sections[0].claims[0];

    act(() => {
      result.current.finalizeBriefingEdition(editionId);
    });
    expect(result.current.briefingEditions.find((edition) => edition.id === editionId)!.status).toBe("finalized");

    act(() => {
      result.current.editBriefingClaimText(editionId, created.edition.sections[0].id, claim.id, "Edited text");
    });
    const afterEdit = result.current.briefingEditions.find((edition) => edition.id === editionId)!;
    expect(afterEdit.sections[0].claims[0].text).toBe(claim.text);
    expect(afterEdit.sections[0].claims[0].editedByUser).toBe(false);
  });

  it("editing a claim's text never changes its evidence or limitationRefs", async () => {
    const { result } = renderHook(() => useSavedWork());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    let created!: ReturnType<typeof result.current.createBriefing>;
    act(() => {
      created = result.current.createBriefing({ name: "Test", entryPath: "instant", audience: "executive", sectionsWanted: ["headline-metrics", "limitations"], scope: { kind: "round-wide" } });
    });
    const sectionId = created.edition.sections[0].id;
    const claim = created.edition.sections[0].claims[0];
    const originalEvidence = claim.evidence;

    act(() => {
      result.current.editBriefingClaimText(created.edition.id, sectionId, claim.id, "A completely rewritten sentence.");
    });

    const edited = result.current.briefingEditions.find((edition) => edition.id === created.edition.id)!.sections[0].claims[0];
    expect(edited.text).toBe("A completely rewritten sentence.");
    expect(edited.editedByUser).toBe(true);
    expect(edited.generatedText).toBe(claim.generatedText);
    expect(edited.evidence).toEqual(originalEvidence);
    expect(edited.limitationRefs).toEqual(claim.limitationRefs);
  });

  it("a user-added claim carries userAdded:true and no evidence, and can be removed again", async () => {
    const { result } = renderHook(() => useSavedWork());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    let created!: ReturnType<typeof result.current.createBriefing>;
    act(() => {
      created = result.current.createBriefing({ name: "Test", entryPath: "instant", audience: "executive", sectionsWanted: ["headline-metrics", "limitations"], scope: { kind: "round-wide" } });
    });
    const sectionId = created.edition.sections[0].id;

    act(() => {
      result.current.addBriefingUserClaim(created.edition.id, sectionId, "Manual analyst note.");
    });

    const withAdded = result.current.briefingEditions.find((edition) => edition.id === created.edition.id)!.sections.find((section) => section.id === sectionId)!;
    const added = withAdded.claims.find((claim) => claim.text === "Manual analyst note.")!;
    expect(added.userAdded).toBe(true);
    expect(added.evidence).toEqual([]);

    act(() => {
      result.current.removeBriefingClaim(created.edition.id, sectionId, added.id);
    });
    const afterRemove = result.current.briefingEditions.find((edition) => edition.id === created.edition.id)!.sections.find((section) => section.id === sectionId)!;
    expect(afterRemove.claims.some((claim) => claim.id === added.id)).toBe(false);
  });

  it("duplicate creates a fresh Definition and Draft Edition, never copying another Definition's edition history", async () => {
    const { result } = renderHook(() => useSavedWork());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    let created!: ReturnType<typeof result.current.createBriefing>;
    act(() => {
      created = result.current.createBriefing({ name: "Original", entryPath: "guided", audience: "marketing", sectionsWanted: ["headline-metrics", "limitations"], scope: { kind: "round-wide" } });
    });
    act(() => {
      result.current.updateBriefingToCurrent(created.definition.id);
    });
    expect(result.current.briefingEditions).toHaveLength(2);

    let duplicated!: ReturnType<typeof result.current.duplicateBriefing>;
    act(() => {
      duplicated = result.current.duplicateBriefing(created.definition.id);
    });

    expect(duplicated?.definition.name).toBe("Original (copy)");
    expect(duplicated?.edition.status).toBe("draft");
    const editionsForDuplicate = result.current.briefingEditions.filter((edition) => edition.definitionId === duplicated?.definition.id);
    expect(editionsForDuplicate).toHaveLength(1);
  });

  it("rename only touches name/updatedAt; delete cascades to all of that Definition's editions", async () => {
    const { result } = renderHook(() => useSavedWork());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    let created!: ReturnType<typeof result.current.createBriefing>;
    act(() => {
      created = result.current.createBriefing({ name: "Before", entryPath: "instant", audience: "executive", sectionsWanted: ["headline-metrics", "limitations"], scope: { kind: "round-wide" } });
    });
    act(() => {
      result.current.renameBriefing(created.definition.id, "After");
    });
    const renamed = result.current.briefingDefinitions.find((entry) => entry.id === created.definition.id)!;
    expect(renamed.name).toBe("After");
    expect(renamed.scope).toEqual(created.definition.scope);

    act(() => {
      result.current.updateBriefingToCurrent(created.definition.id);
    });
    expect(result.current.briefingEditions.filter((edition) => edition.definitionId === created.definition.id)).toHaveLength(2);

    act(() => {
      result.current.deleteBriefing(created.definition.id);
    });
    expect(result.current.briefingDefinitions).toHaveLength(0);
    expect(result.current.briefingEditions.filter((edition) => edition.definitionId === created.definition.id)).toHaveLength(0);
  });

  it("persists Briefing Definitions and Editions across hook remounts (browser-local storage)", async () => {
    const first = renderHook(() => useSavedWork());
    await waitFor(() => expect(first.result.current.hydrated).toBe(true));

    act(() => {
      first.result.current.createBriefing({ name: "Persisted briefing", entryPath: "instant", audience: "executive", sectionsWanted: ["headline-metrics", "limitations"], scope: { kind: "round-wide" } });
    });
    first.unmount();

    const second = renderHook(() => useSavedWork());
    await waitFor(() => expect(second.result.current.hydrated).toBe(true));
    expect(second.result.current.briefingDefinitions).toHaveLength(1);
    expect(second.result.current.briefingDefinitions[0].name).toBe("Persisted briefing");
  });

  it("structurally refuses to remove, edit, add to, or toggle off the limitations section — not just via a UI hint", async () => {
    const { result } = renderHook(() => useSavedWork());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    let created!: ReturnType<typeof result.current.createBriefing>;
    act(() => {
      created = result.current.createBriefing({ name: "Test", entryPath: "instant", audience: "executive", sectionsWanted: ["headline-metrics", "limitations"], scope: { kind: "round-wide" } });
    });
    const limitationsSection = created.edition.sections.find((section) => section.id === "limitations")!;
    const limitationClaim = limitationsSection.claims[0];
    const originalClaimCount = limitationsSection.claims.length;

    act(() => {
      result.current.removeBriefingClaim(created.edition.id, "limitations", limitationClaim.id);
    });
    act(() => {
      result.current.editBriefingClaimText(created.edition.id, "limitations", limitationClaim.id, "Rewritten limitation");
    });
    act(() => {
      result.current.addBriefingUserClaim(created.edition.id, "limitations", "A manual limitation note");
    });
    act(() => {
      result.current.toggleBriefingSectionIncluded(created.edition.id, "limitations");
    });

    const after = result.current.briefingEditions.find((edition) => edition.id === created.edition.id)!;
    const afterLimitations = after.sections.find((section) => section.id === "limitations")!;
    expect(afterLimitations.claims).toHaveLength(originalClaimCount);
    expect(afterLimitations.claims.find((claim) => claim.id === limitationClaim.id)!.text).toBe(limitationClaim.text);
    expect(afterLimitations.included).toBe(true);
  });

  it("resolves a watchlist-scoped briefing's generation context from live watchlist state, defensively empty if deleted", async () => {
    const { result } = renderHook(() => useSavedWork());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    let list!: ReturnType<typeof result.current.createWatchlist>;
    act(() => {
      list = result.current.createWatchlist("Priority");
      result.current.addItemToWatchlist(list.id, { entityType: "organizations", entityKey: "Atlas Digital", label: "Atlas Digital", recordCountAtAdd: 999 });
    });

    let created!: ReturnType<typeof result.current.createBriefing>;
    act(() => {
      created = result.current.createBriefing({
        name: "Watchlist briefing",
        entryPath: "guided",
        audience: "commercial",
        sectionsWanted: ["headline-metrics", "watchlist-summary", "limitations"],
        scope: { kind: "watchlist", watchlistId: list.id, watchlistName: "Priority" },
      });
    });

    const summarySection = created.edition.sections.find((section) => section.id === "watchlist-summary")!;
    expect(summarySection.claims.some((claim) => claim.text.includes("Atlas Digital") && claim.text.includes("999"))).toBe(true);

    act(() => {
      result.current.deleteWatchlist(list.id);
    });
    expect(result.current.currentBriefingScopeCount({ kind: "watchlist", watchlistId: list.id, watchlistName: "Priority" })).toBe(0);
  });
});
