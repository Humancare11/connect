// Build-time off switches: ON unless the variable is set to exactly "false".
export const flagEnabled = (value) => String(value ?? "").trim().toLowerCase() !== "false";
