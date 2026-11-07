import type { Metadata } from "next";
import { Alert, Card, PageHeader } from "@/components/ui/misc";
import { ChangePasswordForm, DeleteAccount, EmailPreferences, TwoFactorSettings } from "@/features/account/client";
import { requireUserPage } from "@/server/auth/session";
import { getEmailPreferences } from "@/server/services/account-settings";

export const metadata: Metadata = { title: "Paramètres" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ securite?: string }> }) {
  const { securite } = await searchParams;
  const user = await requireUserPage("/compte/parametres");
  const prefs = await getEmailPreferences(user.id);
  return (
    <>
      <PageHeader title="Paramètres" />
      {securite === "2fa-requise" ? <Alert tone="warning" title="Double authentification requise">L&apos;accès à l&apos;administration exige la double authentification. Activez-la ci-dessous.</Alert> : null}
      <Card className="grid gap-4 p-5">
        <h2 className="font-bold">Mot de passe</h2>
        <ChangePasswordForm />
      </Card>
      <Card className="grid gap-4 p-5" id="2fa">
        <h2 className="font-bold">Double authentification</h2>
        <TwoFactorSettings enabled={user.twoFactorEnabled} />
      </Card>
      <Card className="grid gap-4 p-5">
        <h2 className="font-bold">Emails</h2>
        <EmailPreferences prefs={prefs} />
        <p className="text-xs text-muted-foreground">Aucune communication commerciale sans votre consentement explicite. Vous pouvez retirer votre consentement à tout moment.</p>
      </Card>
      <Card className="grid gap-4 border-destructive/30 p-5">
        <h2 className="font-bold text-destructive">Supprimer mon compte</h2>
        <DeleteAccount />
      </Card>
    </>
  );
}
