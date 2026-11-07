import { Alert, Badge, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui/misc";
import { ApiClientForm, CategoryFlag, ComplianceRecordForm, ComplianceRuleControl, CountryControl, FeeRuleForm, FlagToggle, RevokeApiClientButton, SettingEditor } from "@/features/admin/client";
import { AdminTable } from "@/features/admin/table";
import { can, requirePermissionPage } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { listFlags, listSettings } from "@/server/settings";

export const metadata = { title: "Configuration" };

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });
const COMPLIANCE_TONES = { ALLOWED: "success", CONDITIONAL: "info", TO_VERIFY: "warning", PROHIBITED: "danger" } as const;
const COMPLIANCE_LABELS: Record<string, string> = { ALLOWED: "Autorisé", CONDITIONAL: "Conditionnel", TO_VERIFY: "À vérifier (bloquant)", PROHIBITED: "Interdit" };
const SECTIONS = [
  ["indicateurs", "Indicateurs"],
  ["reglages", "Réglages"],
  ["commission", "Commission"],
  ["pays", "Pays"],
  ["conformite", "Conformité"],
  ["categories", "Catégories"],
  ["api", "API Tamurt HQ"],
] as const;

export default async function AdminConfigPage() {
  const staff = await requirePermissionPage("settings.read");
  const [flags, settings, feeRules, countries, rules, records, categories, apiClients] = await Promise.all([
    listFlags(),
    listSettings(),
    db.feeRule.findMany({ orderBy: { activeFrom: "desc" }, take: 20 }),
    db.country.findMany({ orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }] }),
    db.complianceRule.findMany({ orderBy: [{ originCountry: "asc" }, { destinationCountry: "asc" }], include: { category: { select: { name: true } } } }),
    db.complianceRecord.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    db.category.findMany({ orderBy: [{ parentId: { sort: "asc", nulls: "first" } }, { sortOrder: "asc" }], select: { id: true, name: true, parentId: true, isActive: true, requiresReview: true, isProhibited: true, isTransactional: true, _count: { select: { listings: true } } } }),
    can(staff, "api_clients.manage") ? db.serviceApiClient.findMany({ orderBy: { createdAt: "desc" } }) : [],
  ]);
  const activeBuyerFee = feeRules.find((r) => r.kind === "BUYER_PROTECTION" && !r.activeUntil && !r.currency && !r.countryCode);
  const canFlags = can(staff, "flags.write");
  const canSettings = can(staff, "settings.write");
  const canCompliance = can(staff, "compliance.write");
  const parentName = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <>
      <PageHeader title="Configuration" description="Chaque modification est journalisée (auteur, valeur précédente, nouvelle valeur)." />
      <nav aria-label="Sections" className="flex flex-wrap gap-2 text-sm">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="rounded-full border border-border bg-card px-3 py-1 font-medium hover:bg-muted">
            {label}
          </a>
        ))}
      </nav>

      <section id="indicateurs" aria-labelledby="indicateurs-t" className="grid gap-3">
        <h2 id="indicateurs-t" className="text-lg font-bold">
          Indicateurs de fonctionnalités
        </h2>
        <AdminTable
          head={["Clé", "Description", "État"]}
          rows={flags.map((f) => [
            <code key="k" className="text-xs">
              {f.key}
            </code>,
            <span key="d" className="text-sm">
              {f.description}
            </span>,
            <FlagToggle key="t" flagKey={f.key} enabled={f.enabled} canWrite={canFlags} critical={f.key === "checkout.crossBorder"} />,
          ])}
        />
      </section>

      <section id="reglages" aria-labelledby="reglages-t" className="grid gap-3">
        <h2 id="reglages-t" className="text-lg font-bold">
          Réglages de la plateforme
        </h2>
        <AdminTable
          head={["Clé", "Valeur par défaut", "Valeur"]}
          rows={settings.map((s) => [
            <code key="k" className="text-xs">
              {s.key}
            </code>,
            <code key="d" className="text-xs text-muted-foreground">
              {JSON.stringify(s.defaultValue)}
            </code>,
            <SettingEditor key="v" settingKey={s.key} value={s.value} canWrite={canSettings} />,
          ])}
        />
      </section>

      <section id="commission" aria-labelledby="commission-t" className="grid gap-3">
        <h2 id="commission-t" className="text-lg font-bold">
          Frais de protection acheteur
        </h2>
        <Card>
          <CardContent className="grid gap-4 pt-5">
            <p className="text-sm">
              Taux en vigueur : <strong>{activeBuyerFee ? `${(activeBuyerFee.rateBps / 100).toLocaleString("fr-FR")} %` : "aucune règle"}</strong> du prix de l&apos;article, ajouté au prix payé par l&apos;acheteur (le vendeur reçoit le prix affiché). Calcul
              serveur en unités minimales, arrondi au plus proche. Une modification crée une nouvelle version : les commandes existantes conservent leur tarif figé.
            </p>
            {can(staff, "fees.write") ? <FeeRuleForm currentPercent={activeBuyerFee ? String(activeBuyerFee.rateBps / 100) : "10"} /> : null}
            <AdminTable
              head={["Type", "Taux", "Portée", "Du", "Au", "Note"]}
              rows={feeRules.map((r) => [
                r.kind === "BUYER_PROTECTION" ? "Protection acheteur" : "Commission vendeur",
                `${(r.rateBps / 100).toLocaleString("fr-FR")} %${r.fixedAmount ? ` + ${r.fixedAmount}` : ""}`,
                [r.currency, r.countryCode, r.sellerType].filter(Boolean).join(" · ") || "Toutes",
                dateFmt.format(r.activeFrom),
                r.activeUntil ? dateFmt.format(r.activeUntil) : <Badge key="a" tone="success">En vigueur</Badge>,
                <span key="n" className="text-xs">
                  {r.note ?? ""}
                </span>,
              ])}
            />
          </CardContent>
        </Card>
      </section>

      <section id="pays" aria-labelledby="pays-t" className="grid gap-3">
        <h2 id="pays-t" className="text-lg font-bold">
          Pays
        </h2>
        <Alert tone="info">
          Algérie : achat intégré désactivé par défaut (mode petites annonces) faute de solution de paiement pour place de marché validée. Changer de mode exige la permission « conformité » et doit s&apos;appuyer sur une validation enregistrée.
        </Alert>
        <AdminTable
          head={["Pays", "Devise", "Mode", "Versements", "Actif", "Modifier"]}
          rows={countries.map((c) => [
            `${c.name} (${c.code})`,
            c.currency,
            c.checkoutMode === "INTEGRATED" ? "Paiement intégré" : c.checkoutMode === "CLASSIFIED_ONLY" ? "Petites annonces" : "Désactivé",
            c.payoutsEnabled ? "Oui" : "Non",
            c.isActive ? "Oui" : "Non",
            <CountryControl key="c" code={c.code} checkoutMode={c.checkoutMode} payoutsEnabled={c.payoutsEnabled} isActive={c.isActive} canWrite={canCompliance} />,
          ])}
        />
      </section>

      <section id="conformite" aria-labelledby="conformite-t" className="grid gap-3">
        <h2 id="conformite-t" className="text-lg font-bold">
          Matrice de conformité
        </h2>
        <Alert tone="warning">
          Une règle « À vérifier » bloque la transaction : ce n&apos;est jamais un simple avertissement. Ouvrir un flux international exige le nom du professionnel ayant validé la conformité (douane, fiscalité, paiement, transport).
        </Alert>
        <AdminTable
          head={["Origine → destination", "Catégorie", "Prestataire / transporteur", "Statut", "Conditions / base", "Revue", canCompliance ? "Modifier" : ""]}
          rows={rules.map((r) => [
            `${r.originCountry ?? "*"} → ${r.destinationCountry ?? "*"}`,
            r.category?.name ?? "Toutes",
            [r.paymentProvider, r.carrier].filter(Boolean).join(" · ") || "Tous",
            <Badge key="s" tone={COMPLIANCE_TONES[r.status]}>
              {COMPLIANCE_LABELS[r.status]}
            </Badge>,
            <span key="c" className="block max-w-sm text-xs">
              {r.conditions ?? r.notes ?? ""}
              {r.legalBasis ? <span className="block text-muted-foreground">{r.legalBasis}</span> : null}
            </span>,
            <span key="r" className="text-xs">
              {r.reviewedByName ? `${r.reviewedByName}${r.reviewedAt ? `, ${dateFmt.format(r.reviewedAt)}` : ""}` : "Non revue"}
            </span>,
            <ComplianceRuleControl key="e" id={r.id} status={r.status} crossBorder={!!r.originCountry && !!r.destinationCountry && r.originCountry !== r.destinationCountry} canWrite={canCompliance} />,
          ])}
        />
        <Card>
          <CardHeader>
            <CardTitle>Registre des validations</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              Preuves de validation par des professionnels (avocat, expert-comptable, déclarant en douane, prestataire). L&apos;ouverture des achats transfrontaliers exige au moins une validation de corridor valide.
            </p>
            <AdminTable
              head={["Objet", "Intitulé", "Statut", "Validé par", "Le", "Document"]}
              empty="Aucune validation enregistrée : les flux internationaux restent fermés."
              rows={records.map((r) => [`${r.subjectType} · ${r.subjectRef}`, r.title, r.status, r.validatedBy, dateFmt.format(r.validatedAt), r.documentRef ?? "—"])}
            />
            {canCompliance ? <ComplianceRecordForm /> : null}
          </CardContent>
        </Card>
      </section>

      <section id="categories" aria-labelledby="categories-t" className="grid gap-3">
        <h2 id="categories-t" className="text-lg font-bold">
          Catégories
        </h2>
        <AdminTable
          head={["Catégorie", "Annonces", "Réglages"]}
          rows={categories.map((c) => [
            <span key="n" className={c.parentId ? "ps-4" : "font-semibold"}>
              {c.parentId ? `${parentName.get(c.parentId)} › ` : ""}
              {c.name}
            </span>,
            c._count.listings,
            <div key="f" className="flex flex-wrap gap-3">
              <CategoryFlag id={c.id} field="isActive" value={c.isActive} canWrite={canSettings} label="Active" />
              <CategoryFlag id={c.id} field="isTransactional" value={c.isTransactional} canWrite={canSettings} label="Achat intégré" />
              <CategoryFlag id={c.id} field="requiresReview" value={c.requiresReview} canWrite={canSettings} label="Vérification" />
              <CategoryFlag id={c.id} field="isProhibited" value={c.isProhibited} canWrite={canSettings} label="Interdite" />
            </div>,
          ])}
        />
      </section>

      {can(staff, "api_clients.manage") ? (
        <section id="api" aria-labelledby="api-t" className="grid gap-3">
          <h2 id="api-t" className="text-lg font-bold">
            API interne Tamurt HQ
          </h2>
          <p className="text-sm text-muted-foreground">
            Jetons de service pour <code>/api/internal/hq/v1/metrics</code> : indicateurs agrégés uniquement (aucune donnée personnelle), portée « lecture des indicateurs », restriction d&apos;adresses IP possible. Seule l&apos;empreinte du jeton est stockée.
          </p>
          <ApiClientForm />
          <AdminTable
            head={["Nom", "Préfixe", "Portées", "IP autorisées", "Créé", "Dernier usage", ""]}
            empty="Aucun jeton."
            rows={apiClients.map((c) => [
              c.name,
              <code key="p" className="text-xs">
                {c.tokenPrefix}…
              </code>,
              c.scopes.join(", "),
              c.allowedIps.join(", ") || "Toutes",
              dateFmt.format(c.createdAt),
              c.lastUsedAt ? dateFmt.format(c.lastUsedAt) : "—",
              c.revokedAt ? <Badge key="r" tone="neutral">Révoqué</Badge> : <RevokeApiClientButton key="r" id={c.id} />,
            ])}
          />
        </section>
      ) : null}
    </>
  );
}
