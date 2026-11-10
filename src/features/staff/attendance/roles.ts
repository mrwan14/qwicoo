/** Roles that review the team's attendance and correct it. */
export const ATTENDANCE_MANAGERS: ReadonlySet<string> = new Set(["SUPER_ADMIN", "BRAND_ADMIN", "BRANCH_ADMIN"]);

/** Till clock is for a shared till (several people, each with a PIN): the cashier's device and managers. */
export const TILL_ROLES: ReadonlySet<string> = new Set(["CASHIER", ...ATTENDANCE_MANAGERS]);
