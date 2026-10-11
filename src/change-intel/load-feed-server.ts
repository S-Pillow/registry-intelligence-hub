import { readLatestFeed } from "@/change-intel/state-io";
import type { ChangeIntelFeedState } from "@/change-intel/types";

/** Server-only local feed load — never contacts ICANN. */
export async function loadChangeIntelFeed(): Promise<ChangeIntelFeedState> {
  return readLatestFeed(process.cwd());
}
