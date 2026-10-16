export const json = (v: unknown) =>
  typeof v === "string" ? v : JSON.stringify(v, null, 2);
export const stamp = (v: unknown) =>
  typeof v === "string" && !Number.isNaN(Date.parse(v))
    ? new Date(v).toISOString().replace("T", " ").replace("Z", " UTC")
    : "Not recorded";
