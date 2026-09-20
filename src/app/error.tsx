"use client";

import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorState({ reset }: { reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f6f8] px-4">
      <div className="max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
        <CircleAlert className="mx-auto mb-4 size-10 text-red-700" />
        <h1 className="text-xl font-semibold">Registry Intelligence Hub unavailable</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">This isolated route failed safely. The ForgeForward shell and existing tools are not affected.</p>
        <Button onClick={reset} className="mt-6 bg-[#007d65]">Try again</Button>
      </div>
    </main>
  );
}
