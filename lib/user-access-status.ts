/** Shared rules for who can use Orion (admin + API). */

export type UserAccessRow = {
  role?: string;
  isBlocked?: boolean;
  isActive?: boolean;
  accessExpiresAt?: Date | string | null;
};

export type AccessFilter = "all" | "active" | "inactive" | "blocked";

export function isUserAccessActive(u: UserAccessRow, now = new Date()): boolean {
  if (u.role === "admin") return !u.isBlocked;
  if (u.isBlocked) return false;
  if (!u.isActive) return false;
  if (u.accessExpiresAt) {
    const exp = new Date(u.accessExpiresAt);
    if (!Number.isNaN(exp.getTime()) && exp < now) return false;
  }
  return true;
}

export function classifyAccessFilter(u: UserAccessRow, now = new Date()): AccessFilter {
  if (u.isBlocked) return "blocked";
  if (isUserAccessActive(u, now)) return "active";
  return "inactive";
}

/** Prisma `where` for list queries — must match classifyAccessFilter / stats. */
export function accessFilterPrismaWhere(
  status: Exclude<AccessFilter, "all">,
  now = new Date()
): Record<string, unknown> {
  const activeOr = [
    { role: "admin" },
    {
      isActive: true,
      OR: [
        { accessExpiresAt: null },
        { accessExpiresAt: { gt: now } },
      ],
    },
  ];

  if (status === "blocked") {
    return { isBlocked: true };
  }
  if (status === "active") {
    return { isBlocked: false, OR: activeOr };
  }
  return {
    isBlocked: false,
    NOT: { OR: activeOr },
  };
}
