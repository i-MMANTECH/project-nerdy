import { toast } from "sonner";

/** One Sonner summary after bulk renew completes (per-row detail stays in the results dialog). */
export function toastBulkRenewSummary(results: { ok: boolean }[]) {
  const n = results.length;
  if (n === 0) return;
  const okCount = results.filter((r) => r.ok).length;
  const failCount = n - okCount;
  if (failCount === 0) {
    toast.success(`Renewed ${okCount} account${okCount === 1 ? "" : "s"}.`);
  } else if (okCount === 0) {
    toast.error(`Renew failed for all ${failCount} account${failCount === 1 ? "" : "s"}.`, {
      description: "Open the results dialog for each error message.",
    });
  } else {
    toast.warning(`Bulk renew: ${okCount} succeeded, ${failCount} failed.`, {
      description: "See the dialog for per-account messages.",
    });
  }
}
