"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useState,
  type FocusEvent,
} from "react";
import {
  INTELLIGENCE_PULSE_INTERVAL_MS,
  type CommandCenterInsight,
} from "@/lib/command-center-insights";

function formatPulseIndex(index: number, total: number): string {
  const width = Math.max(2, String(total).length);
  return `${String(index + 1).padStart(width, "0")} / ${String(total).padStart(width, "0")}`;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

/**
 * Rotating deterministic Intelligence Pulse for Command Center.
 * Consumes pre-built insights only — no business-rule calculations.
 */
export function CommandCenterIntelligencePulse({
  insights,
}: {
  insights: readonly CommandCenterInsight[];
}) {
  const headingId = useId();
  const reducedMotion = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [documentHidden, setDocumentHidden] = useState(false);
  const [progressEpoch, setProgressEpoch] = useState(0);

  const total = insights.length;
  const canRotate = total > 1;
  const autoSuspended = hovering || focusWithin || documentHidden;
  const rotating = canRotate && !userPaused && !autoSuspended;

  useEffect(() => {
    const sync = () => setDocumentHidden(document.visibilityState !== "visible");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  // Derive a safe display index — avoid setState-in-effect clamping cascades.
  const displayIndex = total > 0 ? index % total : 0;

  useEffect(() => {
    if (!rotating) return;
    const timer = window.setTimeout(() => {
      setIndex((current) => (current + 1) % total);
      setProgressEpoch((epoch) => epoch + 1);
    }, INTELLIGENCE_PULSE_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [rotating, displayIndex, total, progressEpoch]);

  const bumpProgress = useCallback(() => {
    setProgressEpoch((epoch) => epoch + 1);
  }, []);

  const onPauseToggle = () => {
    setUserPaused((paused) => {
      const next = !paused;
      if (!next) bumpProgress();
      return next;
    });
  };

  const onFocusWithin = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.target as Node)) return;
    setFocusWithin(true);
  };

  const onBlurWithin = (event: FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    setFocusWithin(false);
    if (!userPaused) bumpProgress();
  };

  const onMouseEnter = () => setHovering(true);
  const onMouseLeave = () => {
    setHovering(false);
    if (!userPaused) bumpProgress();
  };

  if (total === 0) return null;

  const insight = insights[displayIndex]!;
  const progressPaused = !rotating;

  return (
    <section
      aria-labelledby={headingId}
      data-testid="cc-intelligence-pulse"
      data-insight-id={insight.id}
      data-paused={userPaused ? "true" : "false"}
      data-auto-suspended={autoSuspended ? "true" : "false"}
      data-rotating={rotating ? "true" : "false"}
      className="rounded-xl border border-slate-200 bg-white shadow-sm"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocusWithin}
      onBlur={onBlurWithin}
    >
      <div className="px-4 pb-3 pt-4 sm:px-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006a56]">
              Intelligence Pulse
            </p>
            <h2 id={headingId} className="sr-only">
              Deterministic intelligence highlights
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p
              className="text-xs font-semibold tabular-nums text-slate-500"
              data-testid="cc-pulse-counter"
              aria-label={`Insight ${displayIndex + 1} of ${total}`}
            >
              {formatPulseIndex(displayIndex, total)}
            </p>
            <button
              type="button"
              className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007d65]"
              data-testid="cc-pulse-pause"
              aria-pressed={userPaused}
              onClick={onPauseToggle}
            >
              {userPaused ? "Resume" : "Pause"}
            </button>
          </div>
        </header>

        <div
          className="mt-3 min-h-[7.5rem] sm:min-h-[6.25rem]"
          data-testid="cc-pulse-message-slot"
          aria-live="off"
        >
          <article
            key={`${insight.id}-${displayIndex}`}
            data-testid="cc-pulse-message"
            className={reducedMotion ? undefined : "cc-pulse-enter"}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {insight.category}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-900 sm:text-[15px]">
              <span className="font-semibold">{insight.lead}</span>{" "}
              <span>{insight.body}</span>
            </p>
            {insight.href && insight.linkLabel ? (
              <p className="mt-3 text-xs">
                <span className="text-slate-500">{insight.category}</span>
                <span className="mx-1.5 text-slate-300" aria-hidden>
                  ·
                </span>
                <Link
                  href={insight.href}
                  className="font-semibold text-[#006a56] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007d65]"
                  data-testid="cc-pulse-link"
                >
                  {insight.linkLabel}
                  <span aria-hidden> →</span>
                </Link>
              </p>
            ) : (
              <p className="mt-3 text-xs text-slate-500">{insight.category}</p>
            )}
          </article>
        </div>
      </div>

      <div
        className="h-0.5 overflow-hidden bg-slate-100"
        data-testid="cc-pulse-progress-track"
        aria-hidden="true"
      >
        {canRotate && !reducedMotion ? (
          <div
            key={`progress-${insight.id}-${progressEpoch}`}
            data-testid="cc-pulse-progress-bar"
            className="cc-pulse-progress-bar h-full origin-left bg-[#007d65]/70"
            style={{
              animationDuration: `${INTELLIGENCE_PULSE_INTERVAL_MS}ms`,
              animationPlayState: progressPaused ? "paused" : "running",
            }}
          />
        ) : (
          <div
            className={`h-full bg-[#007d65]/35 ${canRotate ? "w-full" : "w-0"}`}
            data-testid="cc-pulse-progress-idle"
          />
        )}
      </div>

      <style>{`
        @keyframes cc-pulse-enter-kf {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes cc-pulse-progress-kf {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        .cc-pulse-enter {
          animation: cc-pulse-enter-kf 350ms ease-out;
        }
        .cc-pulse-progress-bar {
          transform-origin: left center;
          animation-name: cc-pulse-progress-kf;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .cc-pulse-enter {
            animation: none;
          }
        }
      `}</style>
    </section>
  );
}
