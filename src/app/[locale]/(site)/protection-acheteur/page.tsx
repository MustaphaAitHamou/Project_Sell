import type { Metadata } from "next";
import { ContentPage, H2 } from "@/components/layout/content-page";
import { Link } from "@/i18n/navigation";
import { getPublicFacts } from "@/server/services/public-facts";

export const metadata: Metadata = {
  title: "Protection acheteur",
  description: "Comment fonctionne la protection acheteur de Tamurt Market : paiement conservé jusqu'à la réception, délai de vérification, litiges et remboursements.",
  alternates: { canonical: "/protection-acheteur" },
};

export default async function BuyerProtectionPage() {
  const f = await getPublicFacts();
  return (
    <ContentPage
      title="Protection acheteur"
      intro="Pour les achats payés sur Tamurt Market, votre paiement n'est versé au vendeur qu'après la remise de l'article et un délai de vérification."
      draft
      toc={[
        { id: "principe", label: "Principe" },
        { id: "couverture", label: "Ce qui est couvert" },
        { id: "exclusions", label: "Exclusions" },
        { id: "procedure", label: "Ouvrir un litige" },
        { id: "decision", label: "Décision et remboursement" },
        { id: "droits", label: "Vos droits légaux" },
      ]}
    >
      <H2 id="principe">Principe</H2>
      <ul>
        <li>Vous payez sur Tamurt Market : le montant est conservé par notre prestataire de paiement, pas par le vendeur.</li>
        <li>
          Le vendeur remet l&apos;article (en main propre avec votre code de remise, ou par expédition suivie). Vous disposez ensuite de <strong>{f.disputeWindowHours} heures</strong> pour vérifier sa conformité.
        </li>
        <li>Sans signalement dans ce délai, ou dès que vous confirmez que tout est conforme, la vente est conclue et le vendeur est payé.</li>
        <li>
          Les frais de protection ({f.feePercent} % du prix de l&apos;article) financent ce service : paiement sécurisé, conservation des fonds, support et traitement des litiges.
        </li>
      </ul>

      <H2 id="couverture">Ce qui est couvert</H2>
      <ul>
        <li>Article non reçu (au-delà de {f.notReceivedAfterDays} jours après l&apos;expédition, ou non remis par le vendeur).</li>
        <li>Article endommagé, ou colis perdu pendant le transport.</li>
        <li>Article non conforme à la description ou aux photos (état, taille, modèle, défaut non signalé).</li>
        <li>Contrefaçon suspectée.</li>
      </ul>

      <H2 id="exclusions">Exclusions</H2>
      <ul>
        <li>Les paiements effectués en dehors de Tamurt Market (virement, espèces, mandat, application de paiement entre particuliers) : nous ne pouvons ni les suivre ni les rembourser.</li>
        <li>Les annonces des pays où l&apos;achat intégré n&apos;est pas disponible (mode « petites annonces », notamment en Algérie à ce jour).</li>
        <li>Le simple changement d&apos;avis après une remise conforme, sauf droit de rétractation légal applicable lorsque le vendeur est un professionnel.</li>
        <li>Les dommages signalés après la fin du délai de vérification.</li>
      </ul>
      <p>
        La protection acheteur est une procédure commerciale de Tamurt Market : <strong>ce n&apos;est pas une assurance</strong>.
      </p>

      <H2 id="procedure">Ouvrir un litige</H2>
      <ul>
        <li>
          Depuis la page de votre commande (<Link href="/compte/commandes">Mes achats</Link>), choisissez « Signaler un problème » avant la fin du délai de vérification.
        </li>
        <li>Décrivez le problème et ajoutez des preuves (photos, documents). Les preuves sont accessibles uniquement aux deux parties et à l&apos;équipe support.</li>
        <li>
          Le vendeur dispose de <strong>{f.sellerResponseHours} heures</strong> pour répondre. Le versement est gelé pendant toute la procédure.
        </li>
        <li>Vous pouvez retirer votre litige à tout moment si le problème est résolu à l&apos;amiable.</li>
      </ul>

      <H2 id="decision">Décision et remboursement</H2>
      <p>
        Un membre de l&apos;équipe support examine le dossier et rend une décision motivée : remboursement intégral, remboursement partiel ou absence de remboursement. Le remboursement est effectué sur le moyen de paiement utilisé.
        Selon la décision, le retour de l&apos;article peut être demandé. [À COMPLÉTER : prise en charge des frais de retour, délais de remboursement du prestataire, voie de recours interne.]
      </p>

      <H2 id="droits">Vos droits légaux</H2>
      <p>
        Cette protection s&apos;ajoute à vos droits et ne les remplace pas. Lorsque le vendeur est un <strong>professionnel</strong> (badge « Pro » sur l&apos;annonce), vous bénéficiez notamment du droit de rétractation et de la
        garantie légale de conformité prévus par le Code de la consommation ; entre particuliers, ces garanties ne s&apos;appliquent pas, mais la garantie des vices cachés du Code civil peut s&apos;appliquer. [À VALIDER : rédaction
        exacte et références légales par un avocat ; droit algérien pour les transactions en Algérie.]
      </p>
    </ContentPage>
  );
}
