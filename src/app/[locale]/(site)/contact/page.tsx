import type { Metadata } from "next";
import { ContentPage, H2 } from "@/components/layout/content-page";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = { title: "Contact", description: "Contacter l'équipe de Tamurt Market.", alternates: { canonical: "/contact" } };

export default function ContactPage() {
  return (
    <ContentPage title="Contact" intro="Pour être traitée rapidement, votre demande doit passer par le bon canal." draft>
      <H2 id="commande">Un problème sur une commande</H2>
      <p>
        Ouvrez un litige depuis la page de la commande (<Link href="/compte/commandes">Mes achats</Link> ou <Link href="/compte/ventes">Mes ventes</Link>) : l&apos;historique et les preuves sont alors directement joints à votre
        demande.
      </p>
      <H2 id="signalement">Un contenu ou un comportement suspect</H2>
      <p>Utilisez le bouton « Signaler » de l&apos;annonce, du profil ou du message concerné. Chaque signalement est examiné par un membre de l&apos;équipe.</p>
      <H2 id="decision">Contester une décision de modération</H2>
      <p>Répondez à la notification reçue ou écrivez à l&apos;adresse ci-dessous en indiquant la référence de l&apos;annonce ou du compte : la décision sera réexaminée par une autre personne.</p>
      <H2 id="autres">Autres demandes (compte, données personnelles, presse, partenariats)</H2>
      <ul>
        <li>Support : [À COMPLÉTER : adresse e-mail du support]</li>
        <li>Données personnelles : [À COMPLÉTER : adresse du délégué à la protection des données ou du référent]</li>
        <li>Autorités (demandes judiciaires, signalements de contenus illicites) : [À COMPLÉTER : point de contact unique]</li>
      </ul>
      <p>
        Avant d&apos;écrire, consultez le <Link href="/centre-aide">centre d&apos;aide</Link>.
      </p>
    </ContentPage>
  );
}
