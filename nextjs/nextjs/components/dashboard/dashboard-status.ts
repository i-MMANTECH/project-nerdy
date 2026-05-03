/** Serializable pie slices for subscriber status charts (server + client safe). */
export type StatusSlice = { name: string; value: number; color: string };

export function buildStatusSlices(input: {
  active: number;
  expired: number;
  inactive: number;
}): StatusSlice[] {
  return [
    { name: "Active", value: input.active, color: "#22d3ee" },
    { name: "Expired", value: input.expired, color: "#f43f5e" },
    { name: "Inactive", value: input.inactive, color: "#94a3b8" },
  ];
}
