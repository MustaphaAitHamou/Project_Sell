import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db, type DbOrTx } from "@/server/db/client";

/** Journal d'audit des opérations sensibles (table en ajout seul, protégée par trigger). */
export async function audit(
  entry: {
    actorId: string | null;
    actorRoles?: string[];
    action: string;
    targetType: string;
    targetId?: string | null;
    metadata?: Prisma.InputJsonValue;
    ipHash?: string | null;
  },
  tx: DbOrTx = db,
) {
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId,
      actorRoles: entry.actorRoles ?? [],
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId ?? null,
      metadata: entry.metadata,
      ipHash: entry.ipHash ?? null,
    },
  });
}
