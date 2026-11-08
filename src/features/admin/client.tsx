"use client";
import { Check, Copy, EyeOff, KeyRound, RotateCcw, ShieldCheck, ShieldOff, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { parseAmountToMinor } from "@/lib/domain/money";
import { cn } from "@/lib/utils";
import {
  categoryToggleAction,
  complianceRecordAction,
  complianceRuleAction,
  countryAction,
  createApiClientAction,
  feeRuleAction,
  flagAction,
  moderateListingAction,
  payoutRetryAction,
  replayWebhooksAction,
  reportAction,
  resolveDisputeAction,
  revokeApiClientAction,
  settingAction,
  userRoleAction,
  userStatusAction,
} from "./actions";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = <T,>(fn: () => Promise<Result<T>>, success?: string, after?: (d: T) => void) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        const detail = res.fieldErrors ? Object.values(res.fieldErrors).flat()[0] : undefined;
        toast.error(detail ? `${res.error} ${detail}` : res.error);
        return;
      }
      if (success) toast.success(success);
      after?.(res.data);
      router.refresh();
    });
  return { pending, run };
}

/** Décision motivée : le motif est communiqué au membre concerné (réexamen possible). */
function ReasonForm({ label, placeholder, onSubmit, pending, tone = "danger", submitLabel, minLength = 5 }: { label: string; placeholder?: string; onSubmit: (reason: string) => void; pending: boolean; tone?: "danger" | "primary"; submitLabel: string; minLength?: number }) {
  const [reason, setReason] = useState("");
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(reason);
      }}
    >
      <Field label={label} htmlFor={`reason-${submitLabel}`}>
        <Textarea id={`reason-${submitLabel}`} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={placeholder} maxLength={1000} />
      </Field>
      <Button type="submit" size="sm" variant={tone === "danger" ? "destructive" : "primary"} loading={pending} disabled={reason.trim().length < minLength}>
        {submitLabel}
      </Button>
    </form>
  );
}

export function ListingModeration({ listingId, status, reportId }: { listingId: string; status: string; reportId?: string }) {
  const { pending, run } = useRun();
  const [mode, setMode] = useState<null | "REJECT" | "SUSPEND" | "REMOVE">(null);
  const decide = (decision: "APPROVE" | "REJECT" | "SUSPEND" | "REINSTATE" | "REMOVE", reason = "") =>
    run(() => moderateListingAction({ listingId, decision, reason, reportId }), { APPROVE: "Annonce validée.", REJECT: "Annonce refusée.", SUSPEND: "Annonce suspendue.", REINSTATE: "Annonce rétablie.", REMOVE: "Annonce retirée." }[decision], () => setMode(null));
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-1.5">
        {status === "PENDING_REVIEW" ? (
          <>
            <Button size="sm" loading={pending} onClick={() => decide("APPROVE")}>
              <Check /> Valider
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => setMode(mode === "REJECT" ? null : "REJECT")}>
              <X /> Refuser
            </Button>
          </>
        ) : null}
        {["ACTIVE", "RESERVED"].includes(status) ? (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => setMode(mode === "SUSPEND" ? null : "SUSPEND")}>
            <EyeOff /> Suspendre
          </Button>
        ) : null}
        {status === "SUSPENDED" ? (
          <Button size="sm" variant="secondary" loading={pending} onClick={() => decide("REINSTATE")}>
            <RotateCcw /> Rétablir
          </Button>
        ) : null}
        {["ACTIVE", "SUSPENDED", "PENDING_REVIEW", "REJECTED", "ARCHIVED"].includes(status) ? (
          <Button size="sm" variant="ghost" className="text-destructive" disabled={pending} onClick={() => setMode(mode === "REMOVE" ? null : "REMOVE")}>
            <Trash2 /> Retirer
          </Button>
        ) : null}
      </div>
      {mode ? (
        <ReasonForm
          label={mode === "REJECT" ? "Motif du refus (communiqué au vendeur)" : mode === "SUSPEND" ? "Motif de la suspension (communiqué au vendeur)" : "Motif du retrait (communiqué au vendeur)"}
          placeholder="Ex. : article interdit à la vente (objets interdits, § 3)."
          submitLabel={mode === "REJECT" ? "Confirmer le refus" : mode === "SUSPEND" ? "Confirmer la suspension" : "Confirmer le retrait"}
          pending={pending}
          onSubmit={(reason) => decide(mode, reason)}
        />
      ) : null}
    </div>
  );
}

export function ReportControls({ reportId, targetType, targetId, canModerateListing, listingStatus }: { reportId: string; targetType: string; targetId: string; canModerateListing: boolean; listingStatus?: string }) {
  const { pending, run } = useRun();
  const [mode, setMode] = useState<null | "dismiss" | "hide">(null);
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" disabled={pending} onClick={() => setMode(mode === "dismiss" ? null : "dismiss")}>
          Classer sans suite
        </Button>
        {targetType === "MESSAGE" || targetType === "REVIEW" ? (
          <Button size="sm" variant="destructive" disabled={pending} onClick={() => setMode(mode === "hide" ? null : "hide")}>
            <EyeOff /> Masquer {targetType === "MESSAGE" ? "le message" : "l'avis"}
          </Button>
        ) : null}
      </div>
      {targetType === "LISTING" && canModerateListing && listingStatus ? <ListingModeration listingId={targetId} status={listingStatus} reportId={reportId} /> : null}
      {mode === "dismiss" ? (
        <ReasonForm label="Note interne (facultative)" submitLabel="Classer" tone="primary" minLength={0} pending={pending} onSubmit={(note) => run(() => reportAction({ reportId, op: "dismiss", note }), "Signalement classé.", () => setMode(null))} />
      ) : null}
      {mode === "hide" ? (
        <ReasonForm
          label="Motif"
          submitLabel="Confirmer le masquage"
          pending={pending}
          onSubmit={(note) => run(() => reportAction({ reportId, op: targetType === "MESSAGE" ? "hideMessage" : "hideReview", targetId, note }), "Contenu masqué.", () => setMode(null))}
        />
      ) : null}
    </div>
  );
}

export function UserStatusControl({ userId, status, canBan }: { userId: string; status: string; canBan: boolean }) {
  const { pending, run } = useRun();
  const [target, setTarget] = useState<"ACTIVE" | "SUSPENDED" | "BANNED">(status === "ACTIVE" ? "SUSPENDED" : "ACTIVE");
  return (
    <div className="grid gap-2">
      <Field label="Nouveau statut" htmlFor={`status-${userId}`}>
        <Select id={`status-${userId}`} value={target} onChange={(e) => setTarget(e.target.value as typeof target)}>
          {status !== "ACTIVE" ? <option value="ACTIVE">Rétablir (actif)</option> : null}
          {status !== "SUSPENDED" ? <option value="SUSPENDED">Suspendre</option> : null}
          {canBan && status !== "BANNED" ? <option value="BANNED">Exclure (réexamen humain possible)</option> : null}
        </Select>
      </Field>
      <ReasonForm
        label="Motif (communiqué au membre)"
        submitLabel={target === "ACTIVE" ? "Rétablir le compte" : target === "BANNED" ? "Exclure le compte" : "Suspendre le compte"}
        tone={target === "ACTIVE" ? "primary" : "danger"}
        pending={pending}
        onSubmit={(reason) => window.confirm("Confirmer cette décision ? Elle sera journalisée.") && run(() => userStatusAction({ userId, status: target, reason }), "Statut mis à jour.")}
      />
    </div>
  );
}

const ROLE_LABELS: Record<string, string> = { MODERATOR: "Modération", SUPPORT: "Support", FINANCE: "Finance", ADMIN: "Administration", SUPER_ADMIN: "Super-administration" };

export function UserRoleControl({ userId, roles, assignable }: { userId: string; roles: string[]; assignable: string[] }) {
  const { pending, run } = useRun();
  if (assignable.length === 0) return <p className="text-sm text-muted-foreground">Vous ne pouvez pas attribuer de rôle.</p>;
  return (
    <fieldset className="grid gap-1.5" disabled={pending}>
      <legend className="mb-1 text-sm font-medium">Rôles du personnel</legend>
      {assignable.map((role) => (
        <label key={role} className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={roles.includes(role)}
            onChange={(e) => {
              const grant = e.target.checked;
              if (window.confirm(`${grant ? "Attribuer" : "Retirer"} le rôle « ${ROLE_LABELS[role] ?? role} » ?`)) run(() => userRoleAction({ userId, role: role as "MODERATOR", grant }), "Rôles mis à jour.");
            }}
          />
          {ROLE_LABELS[role] ?? role}
        </label>
      ))}
    </fieldset>
  );
}

export function ResolveDisputeForm({ disputeId, currency, itemsSubtotal, totalLabel }: { disputeId: string; currency: string; itemsSubtotal: number; totalLabel: string }) {
  const { pending, run } = useRun();
  const [resolution, setResolution] = useState<"FULL_REFUND" | "PARTIAL_REFUND" | "NO_REFUND">("FULL_REFUND");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const minor = resolution === "PARTIAL_REFUND" ? parseAmountToMinor(amount, currency) : null;
  const invalidPartial = resolution === "PARTIAL_REFUND" && (minor === null || minor <= 0 || minor >= itemsSubtotal);
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!window.confirm("Confirmer la décision ? Elle est définitive et sera notifiée aux deux parties.")) return;
        run(() => resolveDisputeAction({ disputeId, resolution, refundAmount: minor ?? undefined, note }), "Décision enregistrée.");
      }}
    >
      <fieldset className="grid gap-1.5">
        <legend className="mb-1 text-sm font-medium">Décision</legend>
        {(
          [
            ["FULL_REFUND", `Remboursement intégral à l'acheteur (${totalLabel})`],
            ["PARTIAL_REFUND", "Remboursement partiel"],
            ["NO_REFUND", "Aucun remboursement : la vente est conclue"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 text-sm">
            <input type="radio" name="resolution" value={value} checked={resolution === value} onChange={() => setResolution(value)} className="accent-primary" />
            {label}
          </label>
        ))}
      </fieldset>
      {resolution === "PARTIAL_REFUND" ? (
        <Field label={`Montant remboursé (${currency})`} htmlFor="refund-amount" hint="Strictement inférieur au prix de l'article." error={amount && invalidPartial ? "Montant invalide." : undefined}>
          <Input id="refund-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-40" />
        </Field>
      ) : null}
      <Field label="Motivation de la décision (visible des deux parties)" htmlFor="resolution-note">
        <Textarea id="resolution-note" rows={4} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
      </Field>
      <Button type="submit" loading={pending} disabled={note.trim().length < 10 || invalidPartial}>
        <ShieldCheck /> Enregistrer la décision
      </Button>
    </form>
  );
}

const CROSS_BORDER_CONFIRMATION = "JE CONFIRME LA VALIDATION JURIDIQUE";

export function FlagToggle({ flagKey, enabled, canWrite, critical }: { flagKey: string; enabled: boolean; canWrite: boolean; critical?: boolean }) {
  const { pending, run } = useRun();
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  if (!canWrite) return <span className={cn("text-sm font-semibold", enabled ? "text-success" : "text-muted-foreground")}>{enabled ? "Activé" : "Désactivé"}</span>;
  return (
    <div className="grid justify-items-end gap-2">
      <Button
        size="sm"
        variant={enabled ? "secondary" : "outline"}
        loading={pending}
        onClick={() => {
          if (critical && !enabled) return setConfirming((c) => !c);
          if (window.confirm(`${enabled ? "Désactiver" : "Activer"} « ${flagKey} » ?`)) run(() => flagAction({ key: flagKey, enabled: !enabled }), "Indicateur mis à jour.");
        }}
      >
        {enabled ? "Activé — désactiver" : "Désactivé — activer"}
      </Button>
      {confirming ? (
        <form
          className="grid w-72 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => flagAction({ key: flagKey, enabled: true, confirmation }), "Transactions transfrontalières activées.", () => setConfirming(false));
          }}
        >
          <p className="text-xs text-muted-foreground">
            Réservé au super-administrateur. Exige une validation juridique de corridor enregistrée au registre de conformité. Saisissez « {CROSS_BORDER_CONFIRMATION} ».
          </p>
          <Input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} aria-label="Confirmation" />
          <Button type="submit" size="sm" variant="destructive" loading={pending} disabled={confirmation !== CROSS_BORDER_CONFIRMATION}>
            Activer
          </Button>
        </form>
      ) : null}
    </div>
  );
}

export function SettingEditor({ settingKey, value, canWrite }: { settingKey: string; value: unknown; canWrite: boolean }) {
  const { pending, run } = useRun();
  const initial = JSON.stringify(value);
  const [draft, setDraft] = useState(initial);
  if (!canWrite) return <code className="text-xs break-all">{initial}</code>;
  return (
    <form
      className="flex flex-wrap items-center justify-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => settingAction({ key: settingKey, value: draft }), "Réglage enregistré.");
      }}
    >
      <Input value={draft} onChange={(e) => setDraft(e.target.value)} className="h-9 w-56 font-mono text-xs" aria-label={`Valeur de ${settingKey}`} />
      <Button type="submit" size="sm" variant="outline" loading={pending} disabled={draft === initial}>
        Enregistrer
      </Button>
    </form>
  );
}

export function FeeRuleForm({ currentPercent }: { currentPercent: string }) {
  const { pending, run } = useRun();
  const [rate, setRate] = useState(currentPercent);
  const [note, setNote] = useState("");
  return (
    <form
      className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        if (!window.confirm(`Créer une nouvelle version de la commission acheteur à ${rate} % ? Elle s'appliquera aux prochaines commandes uniquement ; les commandes existantes conservent leur tarif.`)) return;
        run(() => feeRuleAction({ ratePercent: rate, currency: null, note }), "Nouvelle version de la commission enregistrée.");
      }}
    >
      <Field label="Taux (%)" htmlFor="fee-rate">
        <Input id="fee-rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
      </Field>
      <Field label="Justification (journalisée)" htmlFor="fee-note">
        <Input id="fee-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </Field>
      <Button type="submit" loading={pending} disabled={rate === currentPercent || note.trim().length < 5}>
        Nouvelle version
      </Button>
    </form>
  );
}

export function CountryControl({ code, checkoutMode, payoutsEnabled, isActive, canWrite }: { code: string; checkoutMode: string; payoutsEnabled: boolean; isActive: boolean; canWrite: boolean }) {
  const { pending, run } = useRun();
  if (!canWrite) return <span className="text-sm text-muted-foreground">Lecture seule</span>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        aria-label={`Mode de paiement ${code}`}
        value={checkoutMode}
        disabled={pending}
        className="h-9 w-48"
        onChange={(e) => window.confirm(`Changer le mode de transaction de ${code} ?`) && run(() => countryAction({ code, checkoutMode: e.target.value as "INTEGRATED" }), "Pays mis à jour.")}
      >
        <option value="INTEGRATED">Paiement intégré</option>
        <option value="CLASSIFIED_ONLY">Petites annonces seules</option>
        <option value="DISABLED">Désactivé</option>
      </Select>
      <label className="flex items-center gap-1.5 text-sm">
        <Checkbox checked={payoutsEnabled} disabled={pending} onChange={(e) => window.confirm(`${e.target.checked ? "Activer" : "Désactiver"} les versements vendeurs pour ${code} ?`) && run(() => countryAction({ code, payoutsEnabled: e.target.checked }), "Pays mis à jour.")} />
        Versements
      </label>
      <label className="flex items-center gap-1.5 text-sm">
        <Checkbox checked={isActive} disabled={pending} onChange={(e) => window.confirm(`${e.target.checked ? "Ouvrir" : "Fermer"} ${code} ?`) && run(() => countryAction({ code, isActive: e.target.checked }), "Pays mis à jour.")} />
        Actif
      </label>
    </div>
  );
}

export function ComplianceRuleControl({ id, status, crossBorder, canWrite }: { id: string; status: string; crossBorder: boolean; canWrite: boolean }) {
  const { pending, run } = useRun();
  const [next, setNext] = useState(status);
  const [reviewer, setReviewer] = useState("");
  const [conditions, setConditions] = useState("");
  if (!canWrite) return null;
  const opening = crossBorder && (next === "ALLOWED" || next === "CONDITIONAL") && next !== status;
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => complianceRuleAction({ id, status: next as "ALLOWED", conditions: conditions || undefined, reviewedByName: reviewer || undefined }), "Règle mise à jour.");
      }}
    >
      <div className="flex flex-wrap gap-2">
        <Select aria-label="Statut" value={next} onChange={(e) => setNext(e.target.value)} className="h-9 w-40">
          <option value="ALLOWED">Autorisé</option>
          <option value="CONDITIONAL">Conditionnel</option>
          <option value="TO_VERIFY">À vérifier</option>
          <option value="PROHIBITED">Interdit</option>
        </Select>
        <Button type="submit" size="sm" variant="outline" loading={pending} disabled={next === status || (opening && reviewer.trim().length < 3)}>
          Appliquer
        </Button>
      </div>
      {opening ? (
        <>
          <Input placeholder="Professionnel ayant validé (nom, cabinet)" value={reviewer} onChange={(e) => setReviewer(e.target.value)} aria-label="Validé par" />
          <Input placeholder="Conditions (facultatif)" value={conditions} onChange={(e) => setConditions(e.target.value)} aria-label="Conditions" />
        </>
      ) : null}
    </form>
  );
}

export function ComplianceRecordForm() {
  const { pending, run } = useRun();
  const [v, setV] = useState({ subjectType: "CORRIDOR" as const, subjectRef: "", title: "", validatedBy: "", documentRef: "" });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => complianceRecordAction({ ...v, documentRef: v.documentRef || undefined }), "Validation enregistrée au registre.", () => setV({ subjectType: "CORRIDOR", subjectRef: "", title: "", validatedBy: "", documentRef: "" }));
      }}
    >
      <Field label="Objet" htmlFor="rec-type">
        <Select id="rec-type" value={v.subjectType} onChange={set("subjectType")}>
          <option value="CORRIDOR">Corridor international</option>
          <option value="PAYMENT_PROVIDER">Prestataire de paiement</option>
          <option value="CATEGORY">Catégorie</option>
          <option value="LEGAL_DOCUMENT">Document juridique</option>
          <option value="COUNTRY">Pays</option>
        </Select>
      </Field>
      <Field label="Référence (ex. FR-DZ)" htmlFor="rec-ref">
        <Input id="rec-ref" value={v.subjectRef} onChange={set("subjectRef")} />
      </Field>
      <Field label="Intitulé" htmlFor="rec-title">
        <Input id="rec-title" value={v.title} onChange={set("title")} />
      </Field>
      <Field label="Validé par (professionnel, cabinet)" htmlFor="rec-by">
        <Input id="rec-by" value={v.validatedBy} onChange={set("validatedBy")} />
      </Field>
      <Field label="Référence du document (facultatif, pas de copie de pièce d'identité)" htmlFor="rec-doc" className="sm:col-span-2">
        <Input id="rec-doc" value={v.documentRef} onChange={set("documentRef")} />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" loading={pending} disabled={v.subjectRef.length < 2 || v.title.length < 3 || v.validatedBy.length < 3}>
          Enregistrer la validation
        </Button>
      </div>
    </form>
  );
}

export function CategoryFlag({ id, field, value, canWrite, label }: { id: string; field: "isActive" | "requiresReview" | "isProhibited" | "isTransactional"; value: boolean; canWrite: boolean; label: string }) {
  const { pending, run } = useRun();
  return (
    <label className="flex items-center gap-1.5 text-xs">
      <Checkbox checked={value} disabled={!canWrite || pending} onChange={(e) => run(() => categoryToggleAction({ id, field, value: e.target.checked }), "Catégorie mise à jour.")} />
      {label}
    </label>
  );
}

export function PayoutRetryButton({ payoutId }: { payoutId: string }) {
  const { pending, run } = useRun();
  return (
    <Button size="sm" variant="outline" loading={pending} onClick={() => run(() => payoutRetryAction({ payoutId }), "Nouvelle tentative effectuée.")}>
      <RotateCcw /> Réessayer
    </Button>
  );
}

export function ReplayWebhooksButton() {
  const { pending, run } = useRun();
  return (
    <Button size="sm" variant="outline" loading={pending} onClick={() => run(() => replayWebhooksAction({}), undefined, (d) => toast.success(`${d.replayed} événement(s) rejoué(s).`))}>
      <RotateCcw /> Rejouer les webhooks en échec
    </Button>
  );
}

export function ApiClientForm() {
  const { pending, run } = useRun();
  const [name, setName] = useState("");
  const [ips, setIps] = useState("");
  const [token, setToken] = useState<string | null>(null);
  return (
    <div className="grid gap-3">
      {token ? (
        <div className="grid gap-2 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm text-warning-soft-foreground">
          <p className="font-semibold">Jeton affiché une seule fois : copiez-le dans le gestionnaire de secrets de Tamurt HQ.</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-card px-2 py-1 text-xs text-foreground">{token}</code>
            <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(token).then(() => toast.success("Copié."))}>
              <Copy /> Copier
            </Button>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setToken(null)}>
            J&apos;ai enregistré le jeton
          </Button>
        </div>
      ) : null}
      <form
        className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const allowedIps = ips.split(/[\s,]+/).filter(Boolean);
          run(() => createApiClientAction({ name, scopes: ["metrics:read"], allowedIps }), "Client d'API créé.", (d) => {
            setToken(d.token);
            setName("");
            setIps("");
          });
        }}
      >
        <Field label="Nom du client" htmlFor="api-name">
          <Input id="api-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tamurt HQ — production" />
        </Field>
        <Field label="Adresses IP autorisées (facultatif)" htmlFor="api-ips">
          <Input id="api-ips" value={ips} onChange={(e) => setIps(e.target.value)} placeholder="203.0.113.10, 198.51.100.0" />
        </Field>
        <Button type="submit" loading={pending} disabled={name.trim().length < 3}>
          <KeyRound /> Créer (lecture des indicateurs)
        </Button>
      </form>
    </div>
  );
}

export function RevokeApiClientButton({ id }: { id: string }) {
  const { pending, run } = useRun();
  return (
    <Button size="sm" variant="ghost" className="text-destructive" loading={pending} onClick={() => window.confirm("Révoquer ce jeton ? Tamurt HQ perdra l'accès immédiatement.") && run(() => revokeApiClientAction({ id }), "Jeton révoqué.")}>
      <ShieldOff /> Révoquer
    </Button>
  );
}
