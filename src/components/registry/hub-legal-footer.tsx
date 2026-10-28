"use client";

import Link from "next/link";
import type { ProductPresentation } from "@/lib/presentation-mode";
import { withRehearsalPresentation } from "@/lib/presentation-mode";

const DATA_METHODOLOGY_HREF = "/data-health";

/**
 * Shared RIH fine-print footer: independence + third-party source rights.
 * Render once from the Command Center product shell (not per card).
 */
export function HubLegalFooter({
  presentation = "pre-reveal",
}: {
  presentation?: ProductPresentation;
}) {
  const methodologyHref = withRehearsalPresentation(DATA_METHODOLOGY_HREF, presentation);

  return (
    <footer
      data-testid="hub-legal-footer"
      className="mt-auto border-t border-slate-200 bg-transparent"
    >
      <div className="mx-auto max-w-[1480px] space-y-3 px-4 py-6 text-xs leading-5 text-slate-600 sm:px-6">
        <p data-testid="hub-legal-footer-independence">
          Registry Intelligence Hub is an independent research and intelligence project. It is not
          affiliated with or endorsed by ICANN or IANA.
        </p>
        <p data-testid="hub-legal-footer-source-rights">
          RIH incorporates and derives information from public third-party sources. Third-party data,
          trademarks, source materials, and other content remain subject to their respective ownership,
          copyright, licensing, attribution requirements, and terms of use.
        </p>
        <p>
          <Link
            href={methodologyHref}
            data-testid="hub-legal-footer-methodology-link"
            className="font-semibold text-[#006a56] underline underline-offset-2 hover:text-[#004c3d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007d65]"
          >
            Data &amp; methodology
          </Link>
        </p>
      </div>
    </footer>
  );
}
