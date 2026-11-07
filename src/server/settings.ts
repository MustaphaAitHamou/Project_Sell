import "server-only";
import { FEATURE_FLAGS, PLATFORM_SETTINGS } from "@/lib/config/platform-defaults";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { db } from "@/server/db/client";

/**
 * Réglages et indicateurs de fonctionnalités stockés en base, avec valeurs par défaut
 * versionnées dans le code et cache mémoire court (30 s) : une modification en
 * administration est effective immédiatement sur l'instance qui l'a faite, sous 30 s
 * ailleurs.
 */
type SettingDefaults = { [K in (typeof PLATFORM_SETTINGS)[number] as K["key"]]: K["value"] };
export type SettingKey = keyof SettingDefaults;
export type SettingValue<K extends SettingKey> = SettingDefaults[K] extends number ? number : SettingDefaults[K];
export type FlagKey = (typeof FEATURE_FLAGS)[number]["key"];

const SETTING_DEFAULTS = Object.fromEntries(PLATFORM_SETTINGS.map((s) => [s.key, s.value])) as Record<string, unknown>;
const FLAG_DEFAULTS = Object.fromEntries(FEATURE_FLAGS.map((f) => [f.key, f.enabled])) as Record<string, boolean>;
const TTL_MS = 30_000;

let settingsCache: { at: number; values: Map<string, unknown> } | null = null;
let flagsCache: { at: number; values: Map<string, boolean> } | null = null;

async function loadSettings() {
  if (settingsCache && Date.now() - settingsCache.at < TTL_MS) return settingsCache.values;
  const rows = await db.platformSetting.findMany();
  settingsCache = { at: Date.now(), values: new Map(rows.map((r) => [r.key, r.value])) };
  return settingsCache.values;
}

async function loadFlags() {
  if (flagsCache && Date.now() - flagsCache.at < TTL_MS) return flagsCache.values;
  const rows = await db.featureFlag.findMany();
  flagsCache = { at: Date.now(), values: new Map(rows.map((r) => [r.key, r.enabled])) };
  return flagsCache.values;
}

export function invalidateConfigCache() {
  settingsCache = null;
  flagsCache = null;
}

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  const values = await loadSettings();
  const value = values.has(key) ? values.get(key) : SETTING_DEFAULTS[key];
  const fallback = SETTING_DEFAULTS[key];
  // Garde-fou de type : une valeur corrompue en base retombe sur la valeur par défaut.
  if (typeof fallback === "number" && typeof value !== "number") return fallback as SettingValue<K>;
  return value as SettingValue<K>;
}

export async function getNumberSetting(key: SettingKey): Promise<number> {
  const v = await getSetting(key);
  return typeof v === "number" ? v : Number(SETTING_DEFAULTS[key]);
}

export async function isEnabled(key: FlagKey): Promise<boolean> {
  const values = await loadFlags();
  return values.get(key) ?? FLAG_DEFAULTS[key] ?? false;
}

export async function listFlags() {
  const values = await loadFlags();
  return FEATURE_FLAGS.map((f) => ({ ...f, enabled: values.get(f.key) ?? f.enabled }));
}

export async function listSettings() {
  const values = await loadSettings();
  return PLATFORM_SETTINGS.map((s) => ({ key: s.key, value: values.has(s.key) ? values.get(s.key) : s.value, defaultValue: s.value }));
}

export async function setFlag(key: FlagKey, enabled: boolean, actor: { id: string; roles: string[] }) {
  const def = FEATURE_FLAGS.find((f) => f.key === key);
  if (!def) throw new Error(`Indicateur inconnu : ${key}`);
  await db.$transaction(async (tx) => {
    await tx.featureFlag.upsert({
      where: { key },
      create: { key, enabled, description: def.description, updatedById: actor.id },
      update: { enabled, updatedById: actor.id },
    });
    await audit({ actorId: actor.id, actorRoles: actor.roles, action: "flag.update", targetType: "feature_flag", targetId: key, metadata: { enabled } }, tx);
  });
  invalidateConfigCache();
}

export async function setSetting(key: SettingKey, value: Prisma.InputJsonValue, actor: { id: string; roles: string[] }) {
  if (!(key in SETTING_DEFAULTS)) throw new Error(`Réglage inconnu : ${key}`);
  await db.$transaction(async (tx) => {
    const previous = await tx.platformSetting.findUnique({ where: { key } });
    await tx.platformSetting.upsert({ where: { key }, create: { key, value, updatedById: actor.id }, update: { value, updatedById: actor.id } });
    await audit(
      { actorId: actor.id, actorRoles: actor.roles, action: "setting.update", targetType: "platform_setting", targetId: key, metadata: { previous: previous?.value ?? null, value } },
      tx,
    );
  });
  invalidateConfigCache();
}
