import "server-only";
import { handleFromName, isValidHandle, RESERVED_HANDLES } from "@/lib/domain/ids";
import { db, type DbOrTx } from "@/server/db/client";

/** Trouve un identifiant public libre à partir d'un pseudonyme (« amina », « amina-2 », …). */
export async function availableHandle(base: string, tx: DbOrTx = db, excludeUserId?: string): Promise<string> {
  let root = handleFromName(base);
  if (root.length < 3) root = `${root}-membre`;
  if (RESERVED_HANDLES.has(root)) root = `${root}-membre`;
  root = root.slice(0, 32).replace(/-+$/, "");
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    if (!isValidHandle(candidate)) continue;
    const taken = await tx.userProfile.findUnique({ where: { handle: candidate }, select: { userId: true } });
    if (!taken || taken.userId === excludeUserId) return candidate;
  }
  return `${root}-${crypto.randomUUID().slice(0, 6)}`;
}

export async function createInitialProfile(userId: string, name: string) {
  const handle = await availableHandle(name);
  await db.userProfile.upsert({
    where: { userId },
    create: { userId, handle, displayName: name.slice(0, 60) },
    update: {},
  });
  await db.userVerification.upsert({
    where: { userId_type: { userId, type: "EMAIL" } },
    create: { userId, type: "EMAIL", status: "PENDING", provider: "email" },
    update: {},
  });
}
