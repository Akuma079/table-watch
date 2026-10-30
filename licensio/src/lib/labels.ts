import type { WorkspaceRole } from "@prisma/client";

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  OWNER: "Propriétaire",
  ADMIN: "Administrateur",
  MEMBER: "Membre",
  VIEWER: "Lecture seule",
};

export const dateFormat = new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "short", year: "numeric" });
