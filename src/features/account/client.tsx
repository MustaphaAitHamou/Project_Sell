"use client";
import QRCode from "qrcode";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { contactAction, deleteAccountAction, emailPreferenceAction, enablePayoutsAction } from "./actions";

export function EnablePayoutsButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await enablePayoutsAction({});
          if (!res.ok) return void toast.error(res.error);
          toast.success("Compte de versement activé (simulation).");
          router.refresh();
        })
      }
    >
      Activer mes versements
    </Button>
  );
}

export function EmailPreferences({ prefs }: { prefs: Record<string, boolean> }) {
  const [state, setState] = useState(prefs);
  const labels: Record<string, string> = {
    TRANSACTIONAL: "Commandes, paiements, livraisons et litiges (obligatoires)",
    MESSAGES: "Nouveaux messages",
    SAVED_SEARCHES: "Alertes de recherches sauvegardées",
    ACCOUNT: "Compte, avis et modération de mes annonces",
    MARKETING: "Actualités et offres de Tamurt Market (consentement)",
  };
  return (
    <ul className="grid gap-2">
      {Object.keys(labels).map((k) => (
        <li key={k}>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={state[k] ?? false}
              disabled={k === "TRANSACTIONAL"}
              onChange={async (e) => {
                const enabled = e.target.checked;
                setState((s) => ({ ...s, [k]: enabled }));
                const res = await emailPreferenceAction({ category: k, enabled });
                if (!res.ok) toast.error(res.error);
              }}
            />
            {labels[k]}
          </label>
        </li>
      ))}
    </ul>
  );
}

export function ContactForm({ initial }: { initial: { firstName: string; lastName: string; phone: string } }) {
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await contactAction(v);
          if (!res.ok) toast.error(res.fieldErrors?.phone?.[0] ?? res.error);
          else toast.success("Coordonnées enregistrées.");
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prénom" htmlFor="c-first">
          <Input id="c-first" autoComplete="given-name" value={v.firstName} onChange={(e) => setV({ ...v, firstName: e.target.value })} />
        </Field>
        <Field label="Nom" htmlFor="c-last">
          <Input id="c-last" autoComplete="family-name" value={v.lastName} onChange={(e) => setV({ ...v, lastName: e.target.value })} />
        </Field>
      </div>
      <Field label="Téléphone" htmlFor="c-phone" hint="Jamais affiché publiquement ni transmis à l'autre partie. Vérification par SMS non disponible à ce jour.">
        <Input id="c-phone" type="tel" autoComplete="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
      </Field>
      <Button type="submit" loading={pending} className="w-fit">
        Enregistrer
      </Button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [v, setV] = useState({ current: "", next: "" });
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await authClient.changePassword({ currentPassword: v.current, newPassword: v.next, revokeOtherSessions: true });
          if (res.error) return void toast.error(res.error.status === 400 ? "Mot de passe actuel incorrect ou nouveau mot de passe trop faible." : "Modification impossible.");
          toast.success("Mot de passe modifié ; vos autres sessions ont été déconnectées.");
          setV({ current: "", next: "" });
        });
      }}
    >
      <Field label="Mot de passe actuel" htmlFor="pw-current">
        <Input id="pw-current" type="password" autoComplete="current-password" value={v.current} onChange={(e) => setV({ ...v, current: e.target.value })} />
      </Field>
      <Field label="Nouveau mot de passe" htmlFor="pw-new" hint="10 caractères minimum, avec au moins une lettre et un chiffre.">
        <Input id="pw-new" type="password" autoComplete="new-password" value={v.next} onChange={(e) => setV({ ...v, next: e.target.value })} />
      </Field>
      <Button type="submit" loading={pending} className="w-fit" disabled={v.next.length < 10}>
        Changer le mot de passe
      </Button>
    </form>
  );
}

export function TwoFactorSettings({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [setup, setSetup] = useState<{ qr: string; uri: string; backupCodes: string[] } | null>(null);
  const [code, setCode] = useState("");
  const [pending, start] = useTransition();
  if (enabled)
    return (
      <div className="grid gap-3">
        <Alert tone="success">Double authentification activée.</Alert>
        <Field label="Mot de passe (pour désactiver)" htmlFor="tf-pw">
          <Input id="tf-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button
          variant="destructive-outline"
          className="w-fit"
          loading={pending}
          onClick={() =>
            start(async () => {
              const res = await authClient.twoFactor.disable({ password });
              if (res.error) return void toast.error("Mot de passe incorrect.");
              toast.success("Double authentification désactivée.");
              router.refresh();
            })
          }
        >
          Désactiver
        </Button>
      </div>
    );
  return setup ? (
    <div className="grid gap-4">
      <p className="text-sm">Scannez ce QR code avec votre application d&apos;authentification, puis saisissez le code affiché.</p>
      <img src={setup.qr} alt="QR code de configuration de la double authentification" width={200} height={200} className="rounded-lg border border-border bg-white p-2" />
      <details className="text-xs text-muted-foreground">
        <summary>Saisie manuelle</summary>
        <code className="break-all">{setup.uri}</code>
      </details>
      <Alert tone="warning" title="Codes de secours (à conserver hors ligne)">
        <code className="grid grid-cols-2 gap-1 font-mono text-xs">
          {setup.backupCodes.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </code>
      </Alert>
      <div className="flex items-end gap-2">
        <Field label="Code à 6 chiffres" htmlFor="tf-code">
          <Input id="tf-code" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} />
        </Field>
        <Button
          loading={pending}
          onClick={() =>
            start(async () => {
              const res = await authClient.twoFactor.verifyTotp({ code });
              if (res.error) return void toast.error("Code invalide.");
              toast.success("Double authentification activée.");
              router.refresh();
            })
          }
        >
          Vérifier
        </Button>
      </div>
    </div>
  ) : (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">Protégez votre compte avec une application d&apos;authentification (obligatoire pour l&apos;équipe d&apos;administration).</p>
      <Field label="Mot de passe" htmlFor="tf-pw2">
        <Input id="tf-pw2" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Button
        className="w-fit"
        loading={pending}
        onClick={() =>
          start(async () => {
            const res = await authClient.twoFactor.enable({ password });
            if (res.error || !res.data || !("totpURI" in res.data)) return void toast.error("Mot de passe incorrect.");
            const qr = await QRCode.toDataURL(res.data.totpURI, { margin: 1, width: 200 });
            setSetup({ qr, uri: res.data.totpURI, backupCodes: res.data.backupCodes });
          })
        }
      >
        Activer la double authentification
      </Button>
    </div>
  );
}

export function DeleteAccount() {
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">Vos annonces sont retirées et vos données personnelles anonymisées. Les données de transactions sont conservées sous forme pseudonymisée pour les obligations légales.</p>
      <Field label="Tapez SUPPRIMER pour confirmer" htmlFor="del-confirm">
        <Input id="del-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      <Button
        variant="destructive"
        className="w-fit"
        loading={pending}
        disabled={confirm !== "SUPPRIMER"}
        onClick={() =>
          start(async () => {
            const res = await deleteAccountAction({ confirm: "SUPPRIMER" });
            if (!res.ok) return void toast.error(res.error);
            await authClient.signOut().catch(() => undefined);
            window.location.href = "/";
          })
        }
      >
        Supprimer mon compte
      </Button>
    </div>
  );
}
