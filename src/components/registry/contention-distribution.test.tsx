// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContentionDistributionPanel } from "@/components/registry/contention-distribution";
import type { ContentionSetRow } from "@/lib/contention-intelligence";

afterEach(() => cleanup());

function makeSet(
  setId: string,
  totalApplications: number,
  distinctApplicants: number,
  opts?: { string?: string; godaddy?: boolean },
): ContentionSetRow {
  const godaddyApplications = opts?.godaddy ? 1 : 0;
  return {
    setId,
    appliedForStrings: [opts?.string ?? `s${setId}`],
    totalApplications,
    godaddyApplications,
    nonGodaddyApplications: totalApplications - godaddyApplications,
    distinctApplicants,
    distinctCounterpartApplicants: Math.max(0, distinctApplicants - (opts?.godaddy ? 1 : 0)),
    includesGodaddy: Boolean(opts?.godaddy),
    members: [],
    publicRspContextSummary: "",
  };
}

describe("ContentionDistributionPanel", () => {
  const sets = [
    makeSet("13", 13, 11, { string: "app" }),
    makeSet("10a", 10, 9, { string: "a", godaddy: true }),
    makeSet("10b", 10, 8, { string: "b" }),
    makeSet("10c", 10, 10, { string: "c" }),
    makeSet("4", 4, 3),
  ];

  it("explains contention sets in Applications language, not members", () => {
    render(
      <ContentionDistributionPanel sets={sets} largestSetSize={13} onOpenSet={vi.fn()} />,
    );
    expect(screen.getByTestId("contention-distribution-panel")).toHaveTextContent(
      /How crowded are the contention sets/i,
    );
    expect(screen.getByTestId("contention-set-explanation")).toHaveTextContent(
      /fewer than 13 distinct Applicants/i,
    );
    expect(screen.getByTestId("largest-contention-set-wording")).toHaveTextContent(
      /13 competing Applications/i,
    );
    expect(screen.queryByText(/Size 13/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bSize \d+:/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("contention-dist-size-13")).toHaveTextContent("13 Applications · 1 set");
    expect(screen.getByTestId("contention-dist-size-10")).toHaveTextContent("10 Applications · 3 sets");
  });

  it("reveals matching sets on click and opens set detail", async () => {
    const user = userEvent.setup();
    const onOpenSet = vi.fn();
    render(<ContentionDistributionPanel sets={sets} largestSetSize={13} onOpenSet={onOpenSet} />);

    await user.click(screen.getByTestId("contention-dist-size-13"));
    const reveal13 = screen.getByTestId("contention-dist-reveal");
    expect(reveal13).toHaveTextContent(/1 contention set/i);
    expect(within(reveal13).getByTestId("contention-dist-set-13")).toHaveTextContent(
      /13 Applications · 11 distinct Applicants/i,
    );

    await user.click(screen.getByTestId("contention-dist-size-10"));
    const reveal10 = screen.getByTestId("contention-dist-reveal");
    expect(reveal10).toHaveTextContent(/3 contention sets/i);
    expect(within(reveal10).getByTestId("contention-dist-set-10a")).toBeInTheDocument();
    expect(within(reveal10).getByTestId("contention-dist-set-10b")).toBeInTheDocument();
    expect(within(reveal10).getByTestId("contention-dist-set-10c")).toBeInTheDocument();

    await user.click(
      within(reveal10).getByTestId("contention-dist-set-10a").querySelector("button")!,
    );
    expect(onOpenSet).toHaveBeenCalledWith("10a");
  });

  it("supports keyboard activation of distribution buttons", async () => {
    const user = userEvent.setup();
    render(<ContentionDistributionPanel sets={sets} largestSetSize={13} onOpenSet={vi.fn()} />);
    const button = screen.getByTestId("contention-dist-size-13");
    button.focus();
    expect(button).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("contention-dist-reveal")).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-expanded", "true");
  });
});
