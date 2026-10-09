/**
 * Workspace roles, as Better Auth's organization plugin stores them: a plain
 * string, possibly several roles joined by commas ("admin,member").
 */
export type WorkspaceRole = "owner" | "admin" | "member";

const rolesOf = (role: string) => role.split(",").map((part) => part.trim());

/** Owns the workspace: gets orphan links and alerts nobody else claims. */
export const isOwnerRole = (role: string) => rolesOf(role).includes("owner");

/** Sees the whole team and edits workspace-wide settings. */
export const isManagerRole = (role: string) => rolesOf(role).some((part) => part === "owner" || part === "admin");
