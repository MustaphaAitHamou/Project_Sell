import { AlertTriangle, ArrowRight, Heart, Package, Plus, ShoppingBag, Tag } from "lucide-react";
import type { Metadata } from "next";
import { buttonVariants } from "@/components/ui/button";
import { Alert, Card, PageHeader, StatCard } from "@/components/ui/misc";
import { Link } from "@/i18n/navigation";
import { requireUserPage } from "@/server/auth/session";
import { getAccountOverview } from "@/server/services/account";

export const metadata: Metadata = { title: "Mon compte" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ bienvenue?: string; erreur?: string }> }) {
  const { bienvenue, erreur } = await searchParams;
  const user = await requireUserPage("/compte");
  const o = await getAccountOverview(user.id);
  const active = o.byStatus.ACTIVE ?? 0;
  return (
    <>
      <PageHeader
        title={`Bonjour ${user.profile?.displayName ?? user.name}`}
        description="Retrouvez vos annonces, ventes, achats et messages."
        actions={
          <Link href="/vendre/nouvelle-annonce" className={buttonVariants()}>
            <Plus /> Vendre un article
          </Link>
        }
      />
      {bienvenue ? (
        <Alert tone="success" title="Votre compte est prêt">
          Publiez votre première annonce ou explorez les articles. Pensez à compléter vos coordonnées privées avant votre premier achat avec livraison.
        </Alert>
      ) : null}
      {erreur === "acces-refuse" ? <Alert tone="danger">Vous n&apos;avez pas accès à cette page.</Alert> : null}
      {!user.emailVerified ? <Alert tone="warning">Votre adresse email n&apos;est pas encore confirmée.</Alert> : null}
      {o.salesToProcess > 0 ? (
        <Alert tone="warning" title={`${o.salesToProcess} vente(s) à traiter`}>
          Remettez ou expédiez les articles vendus. <Link href="/compte/ventes">Voir mes ventes</Link>
        </Alert>
      ) : null}
      {o.blockedPayouts > 0 ? (
        <Alert tone="warning" title="Versements en attente">
          {o.blockedPayouts} versement(s) bloqué(s). <Link href="/compte/paiements">Configurer mes versements</Link>
        </Alert>
      ) : null}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Annonces en ligne" value={active} hint={`${o.byStatus.PENDING_REVIEW ?? 0} en vérification · ${o.byStatus.DRAFT ?? 0} brouillon(s)`} />
        <StatCard label="Ventes en cours" value={o.salesToProcess + o.salesInProgress} />
        <StatCard label="Achats en cours" value={o.purchasesInProgress} />
        <StatCard label="Favoris" value={o.favorites} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { href: "/compte/annonces", icon: Tag, title: "Gérer mes annonces", text: "Modifier, désactiver, remettre en ligne." },
          { href: "/compte/ventes", icon: Package, title: "Mes ventes", text: "Remises, expéditions et versements." },
          { href: "/compte/commandes", icon: ShoppingBag, title: "Mes achats", text: "Suivi, réception, litiges." },
          { href: "/compte/favoris", icon: Heart, title: "Mes favoris", text: "Les articles que vous suivez." },
        ].map((c) => (
          <Link key={c.href} href={c.href} className="group">
            <Card className="flex items-center gap-4 p-4 transition-shadow group-hover:shadow-[var(--shadow-lift)]">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                <c.icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{c.title}</p>
                <p className="text-sm text-muted-foreground">{c.text}</p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground rtl:rotate-180" aria-hidden />
            </Card>
          </Link>
        ))}
      </div>
      <Card className="flex gap-3 p-4 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
        <p className="text-muted-foreground">
          Sécurité : Tamurt Market ne vous demandera jamais de payer en dehors de la plateforme, ni de communiquer un code reçu par SMS ou email. En cas de doute, signalez le message.
        </p>
      </Card>
    </>
  );
}
