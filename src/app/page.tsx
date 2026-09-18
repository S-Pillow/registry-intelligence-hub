import Link from "next/link";

export default function Home() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#101923] px-6 text-white">
      <div className="max-w-xl text-center">
        <p className="font-mono text-sm tracking-[0.2em] text-[#72dfb4]">FORGE/FORWARD · PHASE 0</p>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight">Registry Intelligence Hub</h1>
        <p className="mt-4 leading-7 text-slate-300">The Hub is isolated from the catalog while its fixture-backed foundation is rehearsed.</p>
        <Link href="/tools/registry-intelligence-hub" className="mt-8 inline-flex h-10 items-center rounded-lg bg-[#72dfb4] px-5 text-sm font-semibold text-[#0b3129] transition hover:bg-[#93e8c9]">
          Open Command Center
        </Link>
      </div>
    </main>
  );
}
