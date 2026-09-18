// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { CommandCenter } from "./command-center";

afterEach(cleanup);

describe("Command Center interactions", () => {
  it("changes the intelligence set when the View lens changes", async () => {
    const user = userEvent.setup();
    render(<CommandCenter />);

    expect(screen.getByText("IDN interest reaches two regions and two scripts")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Commercial" }));

    expect(screen.getByRole("button", { name: "Commercial" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("IDN interest reaches two regions and two scripts")).not.toBeInTheDocument();
    expect(screen.getByText("Atlas Digital holds the rehearsal fixture’s largest portfolio")).toBeInTheDocument();
  });

  it("opens evidence from a Round Pulse metric investigation path", async () => {
    const user = userEvent.setup();
    render(<CommandCenter />);

    await user.click(screen.getByRole("button", { name: "View evidence for Applications: 12" }));

    expect(await screen.findByText("EVIDENCE & METHOD")).toBeInTheDocument();
    expect(screen.getByText("Applications: 12")).toBeInTheDocument();
    expect(screen.getAllByText("snap-rehearsal-2026-09-16").length).toBeGreaterThan(0);
  });
});
