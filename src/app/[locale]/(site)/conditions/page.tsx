import type { Metadata } from "next";
import { ContentPage, H2 } from "@/components/layout/content-page";
import { Link } from "@/i18n/navigation";
import { getPublicFacts } from "@/server/services/public-facts";

export const metadata: Metadata = {
  title: "Conditions générales",
  description: "Conditions générales d'utilisation et de vente de Tamurt Market (modèle en cours de validation).",
  alternates: { canonical: "/conditions" },
};

export default async function TermsPage() {
  const f = await getPublicFacts();
  return (
    <ContentPage
      title="Conditions générales d'utilisation et de service"
      intro="Ces conditions régissent l'utilisation de Tamurt Market par les acheteurs et les vendeurs, particuliers ou professionnels."
      updated="[À COMPLÉTER : date d'entrée en vigueur]"
      draft
      toc={[
        { id: "objet", label: "1. Objet et rôle de la plateforme" },
        { id: "compte", label: "2. Compte" },
        { id: "annonces", label: "3. Annonces" },
        { id: "classement", label: "4. Classement des annonces" },
        { id: "transactions", label: "5. Transactions et paiement" },
        { id: "frais", label: "6. Frais" },
        { id: "livraison", label: "7. Livraison" },
        { id: "protection", label: "8. Protection acheteur et litiges" },
        { id: "professionnels", label: "9. Vendeurs professionnels" },
        { id: "avis", label: "10. Avis" },
        { id: "moderation", label: "11. Modération et sanctions" },
        { id: "fiscalite", label: "12. Obligations fiscales" },
        { id: "responsabilite", label: "13. Responsabilité" },
        { id: "droit", label: "14. Droit applicable et litiges" },
      ]}
    >
      <H2 id="objet">1. Objet et rôle de la plateforme</H2>
      <p>
        Tamurt Market, édité par [À COMPLÉTER : raison sociale de l&apos;éditeur] (« Tamurt Services »), est une place de marché en ligne qui met en relation des vendeurs et des acheteurs. Tamurt Services n&apos;est{" "}
        <strong>ni le vendeur ni l&apos;acheteur</strong> des articles : le contrat de vente est conclu directement entre les membres. Tamurt Services fournit l&apos;hébergement des annonces, la messagerie, l&apos;intermédiation de
        paiement par l&apos;intermédiaire d&apos;un prestataire agréé, l&apos;accès à des solutions de livraison et une procédure de protection acheteur.
      </p>

      <H2 id="compte">2. Compte</H2>
      <ul>
        <li>L&apos;inscription est réservée aux personnes majeures et capables [À VALIDER : âge minimal]. Les informations fournies doivent être exactes ; l&apos;adresse e-mail doit être confirmée.</li>
        <li>Le compte est personnel. Le membre est responsable de la confidentialité de ses identifiants ; la double authentification est recommandée.</li>
        <li>Un compte peut être supprimé à tout moment depuis les paramètres, sous réserve des transactions en cours.</li>
      </ul>

      <H2 id="annonces">3. Annonces</H2>
      <ul>
        <li>Le vendeur garantit être propriétaire de l&apos;article ou autorisé à le vendre, et décrit fidèlement son état, ses défauts et ses caractéristiques. Les photos doivent représenter l&apos;article réel.</li>
        <li>
          Les articles interdits sont listés sur la page <Link href="/objets-interdits">objets interdits</Link>. Certaines annonces sont vérifiées avant publication.
        </li>
        <li>Il est interdit d&apos;inclure des coordonnées personnelles, des liens de paiement externes ou d&apos;inviter à conclure la transaction en dehors de la plateforme.</li>
        <li>Le vendeur concède à Tamurt Services le droit d&apos;afficher les contenus de l&apos;annonce sur la plateforme et de les reproduire pour sa promotion [À VALIDER : périmètre et durée de la licence].</li>
      </ul>

      <H2 id="classement">4. Classement des annonces</H2>
      <p>
        Par défaut, les résultats de recherche sont classés par <strong>pertinence</strong> par rapport aux mots recherchés (titre, marque, catégorie, description), puis par date de publication ; sans recherche, les annonces les
        plus récentes apparaissent en premier. L&apos;acheteur peut trier par prix ou par date. Aucun emplacement payant ni aucune rémunération n&apos;influence le classement à ce jour.
      </p>

      <H2 id="transactions">5. Transactions et paiement</H2>
      <ul>
        <li>Lorsque l&apos;achat intégré est disponible, l&apos;acheteur paie sur la plateforme ; le paiement est traité par [À COMPLÉTER : prestataire de services de paiement agréé] et conservé jusqu&apos;à la conclusion de la vente.</li>
        <li>Le prix total (article, frais de protection, livraison et, le cas échéant, taxes) est affiché avant la validation. La commande engage l&apos;acheteur à payer et le vendeur à remettre l&apos;article.</li>
        <li>Tamurt Services ne stocke pas les données complètes de carte bancaire.</li>
        <li>L&apos;achat intégré n&apos;est pas disponible dans tous les pays ; dans ce cas, la plateforme fonctionne en petites annonces et la protection acheteur ne s&apos;applique pas.</li>
        <li>Les transactions entre pays ne sont ouvertes qu&apos;après validation de leur conformité (douane, fiscalité, paiement, transport).</li>
      </ul>

      <H2 id="frais">6. Frais</H2>
      <p>
        L&apos;acheteur paie des frais de protection égaux à <strong>{f.feePercent} %</strong> du prix de l&apos;article (exemple : {f.example.price} → {f.example.fee} de frais, {f.example.total} au total hors livraison). La
        publication d&apos;annonces est gratuite et aucune commission n&apos;est prélevée sur le vendeur à ce jour. Toute évolution des frais est annoncée à l&apos;avance et ne s&apos;applique pas aux commandes déjà passées.
      </p>

      <H2 id="livraison">7. Livraison</H2>
      <p>
        Les modes proposés dépendent de l&apos;annonce : remise en main propre confirmée par code, livraison nationale par un transporteur partenaire, ou Tamurt Transport entre la France et l&apos;Algérie. Le vendeur expédie sous{" "}
        {f.shipWithinDays} jours après le paiement ou remet l&apos;article sous {f.handoverWithinDays} jours ; à défaut, la commande peut être annulée et remboursée. Les conditions propres à chaque transporteur s&apos;appliquent en
        complément [À COMPLÉTER].
      </p>

      <H2 id="protection">8. Protection acheteur et litiges</H2>
      <p>
        La procédure est décrite sur la page <Link href="/protection-acheteur">protection acheteur</Link> : délai de vérification de {f.disputeWindowHours} heures, réponse du vendeur sous {f.sellerResponseHours} heures, décision
        motivée de l&apos;équipe support. Les décisions peuvent faire l&apos;objet d&apos;une demande de réexamen.
      </p>

      <H2 id="professionnels">9. Vendeurs professionnels</H2>
      <p>
        Toute personne vendant dans le cadre d&apos;une activité commerciale doit se déclarer professionnelle et fournir ses informations d&apos;identification. Le vendeur professionnel est seul responsable du respect de ses
        obligations envers les consommateurs (information précontractuelle, droit de rétractation, garanties légales, facturation). [À VALIDER : informations à collecter et à afficher.]
      </p>

      <H2 id="avis">10. Avis</H2>
      <p>
        Seuls l&apos;acheteur et le vendeur d&apos;une transaction conclue sur la plateforme peuvent publier un avis sur celle-ci : les avis sont donc liés à une transaction réelle. Ils ne sont ni rémunérés ni triés en fonction de leur
        note. Un membre peut contester un avis qu&apos;il estime illicite ou contraire aux présentes conditions ; l&apos;équipe de modération décide de son maintien ou de son masquage.
      </p>

      <H2 id="moderation">11. Modération et sanctions</H2>
      <ul>
        <li>Tout contenu peut être signalé. Les signalements sont traités par des personnes habilitées ; des outils automatiques peuvent aider à repérer des contenus à risque, mais aucune exclusion définitive n&apos;est décidée automatiquement.</li>
        <li>Les mesures possibles (refus ou retrait d&apos;annonce, masquage d&apos;un message ou d&apos;un avis, suspension ou exclusion de compte) sont motivées et notifiées au membre concerné, qui peut demander un réexamen.</li>
        <li>[À VALIDER : conformité au règlement européen sur les services numériques — exposé des motifs, système interne de traitement des réclamations, règlement extrajudiciaire, signaleurs de confiance.]</li>
      </ul>

      <H2 id="fiscalite">12. Obligations fiscales</H2>
      <p>
        Les revenus tirés des ventes peuvent être imposables. Conformément à la réglementation applicable aux opérateurs de plateformes [À VALIDER : directive DAC7 et article 242 bis du Code général des impôts], Tamurt Services peut
        être tenue de collecter des informations sur certains vendeurs et de déclarer leurs transactions à l&apos;administration fiscale.
      </p>

      <H2 id="responsabilite">13. Responsabilité</H2>
      <p>
        Tamurt Services agit en qualité d&apos;intermédiaire et n&apos;est pas responsable de l&apos;exécution du contrat de vente entre les membres, sous réserve de ses obligations propres (fonctionnement de la plateforme, traitement
        des paiements par son prestataire, procédure de protection acheteur). [À VALIDER : rédaction des limitations de responsabilité conformément au droit de la consommation.]
      </p>

      <H2 id="droit">14. Droit applicable et litiges</H2>
      <p>
        [À VALIDER : droit applicable selon le pays de résidence du membre (France / Algérie), juridiction compétente, médiateur de la consommation (obligatoire en France : nom et coordonnées), plateforme européenne de règlement en
        ligne des litiges.]
      </p>
    </ContentPage>
  );
}
