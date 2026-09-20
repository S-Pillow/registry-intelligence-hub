import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-[#f4f6f8] px-4 py-20 sm:px-6" aria-label="Loading Registry Intelligence Hub">
      <div className="mx-auto max-w-[1480px] space-y-8">
        <div className="space-y-3"><Skeleton className="h-4 w-36" /><Skeleton className="h-10 w-96 max-w-full" /><Skeleton className="h-5 w-[32rem] max-w-full" /></div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}</div>
        <div className="grid gap-6 lg:grid-cols-5"><Skeleton className="h-96 lg:col-span-3" /><Skeleton className="h-96 lg:col-span-2" /></div>
      </div>
    </main>
  );
}
