/** Admin + portal subscriber list GET filters (status query param). */
export const SUBSCRIBER_STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All status" },
  { value: "active", label: "Active" },
  { value: "expiring", label: "Expiring soon" },
  { value: "expired", label: "Expired" },
  { value: "inactive", label: "Inactive" },
  /** Dashboard KPI “Expiry” / “Activity” combined views (match donut segments). */
  { value: "expiry", label: "Expiry (expired + expiring)" },
  { value: "activity", label: "Activity (active + inactive)" },
];

export const PAGE_SIZE_OPTIONS: { value: string; label: string }[] = [
  { value: "10", label: "10" },
  { value: "20", label: "20" },
  { value: "50", label: "50" },
  { value: "100", label: "100" },
];
