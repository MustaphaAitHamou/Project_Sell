import type { Metadata } from "next";
import { ContentPage, H2 } from "@/components/layout/content-page";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = {
  title: "Objets interdits et réglementés",
  description: "Liste des articles interdits ou soumis à vérification sur Tamurt Market, et règles applicables aux envois entre la France et l'Algérie.",
  alternates: { canonical: "/objets-interdits" },
};

export default function ProhibitedPage() {
  return (
    <ContentPage
      title="Objets interdits et réglementés"
      intro="Pour la sécurité de tous et le respect de la loi, certains articles ne peuvent pas être vendus sur Tamurt Market ; d'autres sont vérifiés avant publication."
      draft
      toc={[
        { id: "interdits", label: "Articles interdits" },
        { id: "verifies", label: "Articles vérifiés" },
        { id: "international", label: "Envois internationaux" },
        { id: "signaler", label: "Signaler une annonce" },
      ]}
    >
      <H2 id="interdits">Articles interdits</H2>
      <ul>
        <li>Armes, munitions, répliques d&apos;armes, explosifs, feux d&apos;artifice ; armes blanches dont la vente est réglementée.</li>
        <li>Drogues, stupéfiants et accessoires associés ; médicaments, y compris sans ordonnance, et dispositifs médicaux réglementés.</li>
        <li>Contrefaçons, répliques de marques, copies illégales (logiciels, films, jeux).</li>
        <li>Animaux vivants ; espèces protégées et produits qui en sont issus (ivoire, écailles, peaux).</li>
        <li>Documents officiels et d&apos;identité, permis, cartes grises, faux documents ; billets de banque en cours de validité, titres de paiement.</li>
        <li>Objets volés ou d&apos;origine douteuse ; produits faisant l&apos;objet d&apos;un rappel de sécurité.</li>
        <li>Tabac, produits du vapotage contenant de la nicotine, alcool [À VALIDER : régime applicable aux ventes entre particuliers].</li>
        <li>Contenus pour adultes, données personnelles, comptes en ligne, services illicites.</li>
        <li>Biens culturels dont l&apos;exportation est interdite ou soumise à autorisation (notamment le patrimoine archéologique).</li>
      </ul>

      <H2 id="verifies">Articles vérifiés avant publication</H2>
      <p>
        Les annonces de certaines catégories (puériculture, beauté et bien-être, monnaies et billets de collection) et celles contenant des mots-clés sensibles sont examinées par un membre de l&apos;équipe avant leur mise en
        ligne. Une annonce refusée est accompagnée d&apos;un motif ; vous pouvez la corriger et la soumettre à nouveau, ou contester la décision auprès du support.
      </p>

      <H2 id="international">Envois entre la France et l&apos;Algérie</H2>
      <p>
        Les règles douanières des deux pays limitent ou interdisent l&apos;envoi de certains articles (valeur, quantité, nature). Sur Tamurt Market, ces restrictions sont <strong>bloquantes</strong> : une transaction qui ne
        respecte pas la matrice de conformité ne peut pas être payée. Tant qu&apos;un corridor n&apos;a pas été validé par des professionnels (douane, fiscalité, paiement), les achats internationaux restent fermés. [À VALIDER :
        liste détaillée des restrictions à l&apos;import en Algérie et à l&apos;export depuis la France, franchises et seuils.]
      </p>

      <H2 id="signaler">Signaler une annonce</H2>
      <p>
        Utilisez le bouton « Signaler » présent sur chaque annonce, profil et message. Chaque signalement est examiné par un humain ; aucune sanction définitive n&apos;est prise automatiquement. Voir aussi les{" "}
        <Link href="/conditions">conditions générales</Link>.
      </p>
    </ContentPage>
  );
}
