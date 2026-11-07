import { Camera, MessageCircle, ShieldCheck, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/misc";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = { title: "Vendre sur Tamurt Market", description: "Publiez gratuitement vos articles en quelques minutes." };

export default function SellLandingPage() {
  const steps = [
    { icon: Camera, title: "Photographiez", text: "Jusqu'à 10 photos ; les métadonnées de localisation sont supprimées automatiquement." },
    { icon: MessageCircle, title: "Échangez", text: "Répondez aux acheteurs dans la messagerie, sans dévoiler vos coordonnées." },
    { icon: ShieldCheck, title: "Vendez en sécurité", text: "En France, l'acheteur paie en ligne (service en cours de mise en place) ; ailleurs, remise en main propre." },
    { icon: Wallet, title: "Recevez votre argent", text: "Le prix de vente vous revient : les frais de protection sont payés par l'acheteur." },
  ];
  return (
    <div className="container-page grid gap-10 py-10">
      <div className="grid max-w-2xl gap-4">
        <h1 className="text-3xl font-extrabold sm:text-4xl">Vendez en quelques minutes</h1>
        <p className="text-lg text-muted-foreground">Publier une annonce est gratuit. Vous fixez votre prix, vous recevez ce prix.</p>
        <Link href="/vendre/nouvelle-annonce" className={buttonVariants({ size: "lg", className: "w-fit" })}>
          Publier une annonce
        </Link>
      </div>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.title}>
            <Card className="grid h-full gap-3 p-5">
              <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                <s.icon className="size-5" aria-hidden />
              </span>
              <p className="font-semibold">
                {i + 1}. {s.title}
              </p>
              <p className="text-sm text-muted-foreground">{s.text}</p>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}
