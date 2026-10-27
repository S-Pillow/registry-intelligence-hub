// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommandCenterIntelligencePulse } from "@/components/registry/command-center-intelligence-pulse";
import {
  INTELLIGENCE_PULSE_INTERVAL_MS,
  type CommandCenterInsight,
} from "@/lib/command-center-insights";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

function insight(
  id: string,
  lead: string,
  body = "Body text for layout stability.",
): CommandCenterInsight {
  return {
    id,
    category: "Competitive structure",
    lead,
    body,
    href: "/contention",
    linkLabel: "Explore contention",
    evidenceKeys: [id],
  };
}

const SAMPLE: CommandCenterInsight[] = [
  insight("contention-concentration", "Competition is concentrated:"),
  insight("structural-change-2012-2026", "The 2026 round is smaller:"),
  insight("coverage-disclosure", "Coverage is nearly complete:"),
  insight("official-contention-scale", "Initial contention is broad:"),
  insight("round-composition-brand", "Brand applications are a major part:"),
];

describe("CommandCenterIntelligencePulse", () => {
  it("renders nothing when there are zero insights", () => {
    const { container } = render(<CommandCenterIntelligencePulse insights={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("starts on the first ordered insight", () => {
    render(<CommandCenterIntelligencePulse insights={SAMPLE} />);
    expect(screen.getByTestId("cc-intelligence-pulse")).toHaveAttribute(
      "data-insight-id",
      "contention-concentration",
    );
    expect(screen.getByTestId("cc-pulse-counter")).toHaveTextContent("01 / 05");
    expect(screen.getByTestId("cc-pulse-message")).toHaveTextContent(
      "Competition is concentrated:",
    );
  });

  it("advances after 20 seconds and wraps last → first", () => {
    render(<CommandCenterIntelligencePulse insights={SAMPLE} />);
    act(() => {
      vi.advanceTimersByTime(INTELLIGENCE_PULSE_INTERVAL_MS);
    });
    expect(screen.getByTestId("cc-intelligence-pulse")).toHaveAttribute(
      "data-insight-id",
      "structural-change-2012-2026",
    );
    expect(screen.getByTestId("cc-pulse-counter")).toHaveTextContent("02 / 05");

    for (let step = 0; step < 4; step += 1) {
      act(() => {
        vi.advanceTimersByTime(INTELLIGENCE_PULSE_INTERVAL_MS);
      });
    }
    expect(screen.getByTestId("cc-intelligence-pulse")).toHaveAttribute(
      "data-insight-id",
      "contention-concentration",
    );
    expect(screen.getByTestId("cc-pulse-counter")).toHaveTextContent("01 / 05");
  });

  it("Pause stops rotation and Resume restarts it", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CommandCenterIntelligencePulse insights={SAMPLE} />);

    await user.click(screen.getByTestId("cc-pulse-pause"));
    expect(screen.getByTestId("cc-pulse-pause")).toHaveTextContent("Resume");
    expect(screen.getByTestId("cc-intelligence-pulse")).toHaveAttribute(
      "data-paused",
      "true",
    );

    act(() => {
      vi.advanceTimersByTime(INTELLIGENCE_PULSE_INTERVAL_MS * 2);
    });
    expect(screen.getByTestId("cc-intelligence-pulse")).toHaveAttribute(
      "data-insight-id",
      "contention-concentration",
    );

    await user.click(screen.getByTestId("cc-pulse-pause"));
    expect(screen.getByTestId("cc-pulse-pause")).toHaveTextContent("Pause");
    // Leave focus/hover so auto-suspension ends after explicit Resume.
    fireEvent.blur(screen.getByTestId("cc-pulse-pause"), {
      relatedTarget: document.body,
    });
    fireEvent.mouseLeave(screen.getByTestId("cc-intelligence-pulse"));
    expect(screen.getByTestId("cc-intelligence-pulse")).toHaveAttribute(
      "data-auto-suspended",
      "false",
    );
    expect(screen.getByTestId("cc-intelligence-pulse")).toHaveAttribute(
      "data-rotating",
      "true",
    );
    act(() => {
      vi.advanceTimersByTime(INTELLIGENCE_PULSE_INTERVAL_MS);
    });
    expect(screen.getByTestId("cc-intelligence-pulse")).toHaveAttribute(
      "data-insight-id",
      "structural-change-2012-2026",
    );
  });

  it("hover pauses auto-rotation", () => {
    render(<CommandCenterIntelligencePulse insights={SAMPLE} />);
    fireEvent.mouseEnter(screen.getByTestId("cc-intelligence-pulse"));
    expect(screen.getByTestId("cc-intelligence-pulse")).toHaveAttribute(
      "data-auto-suspended",
      "true",
    );
    act(() => {
      vi.advanceTimersByTime(INTELLIGENCE_PULSE_INTERVAL_MS * 2);
    });
    expect(screen.getByTestId("cc-intelligence-pulse")).toHaveAttribute(
      "data-insight-id",
      "contention-concentration",
    );

    fireEvent.mouseLeave(screen.getByTestId("cc-intelligence-pulse"));
    act(() => {
      vi.advanceTimersByTime(INTELLIGENCE_PULSE_INTERVAL_MS);
    });
    expect(screen.getByTestId("cc-intelligence-pulse")).toHaveAttribute(
      "data-insight-id",
      "structural-change-2012-2026",
    );
  });

  it("focus-within pauses auto-rotation", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CommandCenterIntelligencePulse insights={SAMPLE} />);
    await user.tab();
    expect(screen.getByTestId("cc-pulse-pause")).toHaveFocus();
    expect(screen.getByTestId("cc-intelligence-pulse")).toHaveAttribute(
      "data-auto-suspended",
      "true",
    );
    act(() => {
      vi.advanceTimersByTime(INTELLIGENCE_PULSE_INTERVAL_MS * 2);
    });
    expect(screen.getByTestId("cc-intelligence-pulse")).toHaveAttribute(
      "data-insight-id",
      "contention-concentration",
    );
  });

  it("document hidden pauses auto-rotation", () => {
    render(<CommandCenterIntelligencePulse insights={SAMPLE} />);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(screen.getByTestId("cc-intelligence-pulse")).toHaveAttribute(
      "data-auto-suspended",
      "true",
    );
    act(() => {
      vi.advanceTimersByTime(INTELLIGENCE_PULSE_INTERVAL_MS * 2);
    });
    expect(screen.getByTestId("cc-intelligence-pulse")).toHaveAttribute(
      "data-insight-id",
      "contention-concentration",
    );
  });

  it("shows dynamic 01 / N counter and does not rotate a single insight", () => {
    render(
      <CommandCenterIntelligencePulse
        insights={[insight("only", "Only insight:")]}
      />,
    );
    expect(screen.getByTestId("cc-pulse-counter")).toHaveTextContent("01 / 01");
    act(() => {
      vi.advanceTimersByTime(INTELLIGENCE_PULSE_INTERVAL_MS * 3);
    });
    expect(screen.getByTestId("cc-intelligence-pulse")).toHaveAttribute(
      "data-insight-id",
      "only",
    );
    expect(screen.getByTestId("cc-intelligence-pulse")).toHaveAttribute(
      "data-rotating",
      "false",
    );
  });

  it("exposes accessible Pause/Resume names and non-assertive live region", () => {
    render(<CommandCenterIntelligencePulse insights={SAMPLE} />);
    const pause = screen.getByRole("button", { name: "Pause" });
    expect(pause).toBeInTheDocument();
    expect(screen.getByTestId("cc-pulse-message-slot")).toHaveAttribute(
      "aria-live",
      "off",
    );
    expect(screen.getByTestId("cc-pulse-link")).toHaveAccessibleName(/Explore contention/);
  });
});
