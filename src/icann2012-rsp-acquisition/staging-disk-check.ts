import { statfs } from "node:fs/promises";
import { resolve } from "node:path";
import { RSP_ACQUISITION_LIMITS } from "./constants";

export interface StagingDiskReport {
  stagingRoot: string;
  freeBytes: number | null;
  budgetBytes: number;
  meetsBudget: boolean | null;
  error?: string;
}

export async function inspectStagingDiskSpace(stagingRoot: string): Promise<StagingDiskReport> {
  const budgetBytes = RSP_ACQUISITION_LIMITS.stagingDiskBudgetBytes;
  try {
    const stats = await statfs(resolve(stagingRoot)).catch(async () => statfs(stagingRoot));
    const freeBytes = stats.bsize * stats.bavail;
    return {
      stagingRoot,
      freeBytes,
      budgetBytes,
      meetsBudget: freeBytes >= budgetBytes,
    };
  } catch (err) {
    return {
      stagingRoot,
      freeBytes: null,
      budgetBytes,
      meetsBudget: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
