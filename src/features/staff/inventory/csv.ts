export function importCommitAllowed(rows: readonly { action: "create" | "update" | "error" }[]): boolean {
  return rows.length > 0 && rows.every((row) => row.action !== "error");
}
