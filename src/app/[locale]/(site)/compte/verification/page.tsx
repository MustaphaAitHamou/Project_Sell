import { BadgeCheck, Building2, Mail, Phone, ScanFace } from "lucide-react";
import type { Metadata } from "next";
import { Alert, Badge, Card, PageHeader } from "@/components/ui/misc";
import { BusinessForm } from "@/features/profile/business-form";
import { requireUserPage } from "@/server/auth/session";
import { db } from "@/server/db/client";

export const metadata: Metadata = { title: "Vérifications" };

const TONE = { VERIFIED: "success", PENDING: "warning", REJECTED: "danger", EXPIRED: "neutral", NOT_STARTED: "neutral" } as const;
const LABEL = { VERIFIED: "Vérifié", PENDING: "En attente", REJECTED: "Refusé", EXPIRED: "Expiré", NOT_STARTED: "Non commencé" } as const;

export default async function VerificationPage() {
  const user = await requireUserPage("/compte/verification");
  const [verifications, business] = await Promise.all([db.userVerification.findMany({ where: { userId: user.id } }), db.businessProfile.findUnique({ where: { userId: user.id } })]);
  const get = (type: string) => verifications.find((v) => v.type === type);
  const rows = [
    { icon: Mail, title: "Adresse email", status: user.emailVerified ? "VERIFIED" : (get("EMAIL")?.status ?? "PENDING"), text: "Confirmée par un lien à usage unique." },
    { icon: Phone, title: "Téléphone", status: get("PHONE")?.status ?? "NOT_STARTED", text: "Vérification par SMS non disponible à ce jour (fournisseur SMS non intégré)." },
    { icon: ScanFace, title: "Identité", status: get("IDENTITY")?.status ?? "NOT_STARTED", text: get("IDENTITY")?.provider === "demo" ? "Statut de démonstration (aucune vérification réelle)." : "Vérification par un prestataire agréé : non intégrée à ce jour. Aucune copie de pièce d'identité n'est jamais stockée par Tamurt Market." },
    { icon: Building2, title: "Entreprise", status: business?.verificationStatus ?? "NOT_STARTED", text: "Pour les vendeurs professionnels : contrôle des informations d'immatriculation (vérification par registre officiel à intégrer)." },
  ] as const;
  return (
    <>
      <PageHeader title="Vérifications" description="Les vérifications renforcent la confiance des acheteurs. Seules des références de vérification sont conservées." />
      <ul className="grid gap-3">
        {rows.map((r) => (
          <li key={r.title}>
            <Card className="flex items-start gap-3 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                <r.icon className="size-5" aria-hidden />
              </span>
              <div className="grid flex-1 gap-0.5">
                <p className="flex items-center gap-2 font-semibold">
                  {r.title} <Badge tone={TONE[r.status as keyof typeof TONE]}>{LABEL[r.status as keyof typeof LABEL]}</Badge>
                </p>
                <p className="text-sm text-muted-foreground">{r.text}</p>
              </div>
              {r.status === "VERIFIED" ? <BadgeCheck className="size-5 text-success" aria-hidden /> : null}
            </Card>
          </li>
        ))}
      </ul>
      <Card className="grid gap-4 p-5">
        <h2 className="font-bold">Vous vendez à titre professionnel ?</h2>
        <Alert tone="info">
          La réglementation impose aux plateformes d&apos;identifier les vendeurs professionnels et d&apos;afficher leurs informations aux acheteurs (traçabilité). Vendre régulièrement des articles achetés pour être revendus relève en principe d&apos;une activité professionnelle : renseignez-vous sur vos obligations.
        </Alert>
        {business ? <Alert tone={business.verificationStatus === "VERIFIED" ? "success" : "warning"}>Déclaration enregistrée pour « {business.legalName} » — statut : {LABEL[business.verificationStatus]}.</Alert> : null}
        <BusinessForm initial={business ? { legalName: business.legalName, tradeName: business.tradeName ?? "", legalForm: business.legalForm ?? "", registrationNumber: business.registrationNumber, vatNumber: business.vatNumber ?? "", addressLine1: business.addressLine1, postalCode: business.postalCode ?? "", city: business.city, contactEmail: business.contactEmail, contactPhone: business.contactPhone ?? "" } : undefined} />
      </Card>
    </>
  );
}
