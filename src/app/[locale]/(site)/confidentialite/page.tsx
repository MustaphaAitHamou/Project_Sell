import type { Metadata } from "next";
import { ContentPage, H2 } from "@/components/layout/content-page";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Données personnelles traitées par Tamurt Market, finalités, durées de conservation et droits (modèle en cours de validation).",
  alternates: { canonical: "/confidentialite" },
};

const ROWS: [string, string, string, string][] = [
  ["Compte : e-mail, nom, mot de passe (empreinte), double authentification", "Création et sécurité du compte", "Exécution du contrat", "Durée du compte ; anonymisation à la suppression"],
  ["Profil public : pseudo, nom affiché, ville ou région, photo, avis", "Présentation aux autres membres", "Exécution du contrat", "Durée du compte"],
  ["Téléphone et adresses (jamais publics)", "Livraison, contact en cas de problème de commande", "Exécution du contrat", "Supprimés à la suppression du compte"],
  ["Annonces et photos (métadonnées et position GPS supprimées)", "Publication des annonces", "Exécution du contrat", "Durée de l'annonce ; les annonces vendues restent liées aux commandes"],
  ["Messages et pièces jointes", "Messagerie entre membres, lutte contre la fraude", "Exécution du contrat ; intérêt légitime (sécurité)", "Durée du compte [À VALIDER]"],
  ["Commandes, paiements, remboursements, versements", "Exécution des ventes, comptabilité, litiges", "Contrat ; obligations légales", "10 ans pour les pièces comptables [À VALIDER]"],
  ["Informations des vendeurs professionnels", "Information des acheteurs, obligations fiscales des plateformes", "Obligation légale", "Durée légale [À VALIDER]"],
  ["Litiges et preuves", "Traitement des réclamations", "Exécution du contrat ; intérêt légitime", "5 ans après clôture [À VALIDER]"],
  ["Journaux de sécurité (adresse IP sous forme d'empreinte)", "Prévention des abus, enquêtes de sécurité", "Intérêt légitime ; obligation légale", "[À VALIDER : 6 mois à 1 an]"],
  ["Événements de mesure d'audience internes (sans traceur tiers)", "Statistiques agrégées d'utilisation", "Intérêt légitime", "13 mois, puis suppression automatique"],
];

export default function PrivacyPage() {
  return (
    <ContentPage
      title="Politique de confidentialité"
      intro="Nous ne collectons que les données nécessaires au fonctionnement de la marketplace, nous ne les vendons pas et nous n'utilisons aucun traceur publicitaire."
      updated="[À COMPLÉTER]"
      draft
      toc={[
        { id: "responsable", label: "Responsable du traitement" },
        { id: "donnees", label: "Données et finalités" },
        { id: "destinataires", label: "Destinataires" },
        { id: "transferts", label: "Transferts hors UE" },
        { id: "cookies", label: "Cookies et stockage local" },
        { id: "securite", label: "Sécurité" },
        { id: "droits", label: "Vos droits" },
      ]}
    >
      <H2 id="responsable">Responsable du traitement</H2>
      <p>[À COMPLÉTER : raison sociale, adresse du siège, numéro d&apos;immatriculation, contact du délégué à la protection des données ou du référent.]</p>

      <H2 id="donnees">Données traitées, finalités et durées</H2>
      <div className="not-prose overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-subtle text-xs text-muted-foreground uppercase">
            <tr>
              {["Données", "Finalité", "Base légale", "Conservation"].map((h) => (
                <th key={h} scope="col" className="px-3 py-2 text-start">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r[0]} className="border-t border-border align-top">
                {r.map((c, i) => (
                  <td key={i} className={`px-3 py-2.5 ${i === 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        <strong>Données bancaires :</strong> les données de carte sont saisies directement chez notre prestataire de paiement ; Tamurt Market ne les reçoit ni ne les stocke. <strong>Pièces d&apos;identité :</strong> la vérification
        d&apos;identité, lorsqu&apos;elle est requise, est confiée à un prestataire spécialisé [À COMPLÉTER : prestataire non encore choisi] ; nous ne conservons que le résultat de la vérification, pas de copie du document.
      </p>

      <H2 id="destinataires">Destinataires</H2>
      <ul>
        <li>Les autres membres, pour les seules informations nécessaires à la transaction (l&apos;adresse de livraison n&apos;est transmise au vendeur qu&apos;après le paiement).</li>
        <li>Nos sous-traitants : hébergement, envoi d&apos;e-mails, paiement, livraison, Tamurt Transport pour les envois qu&apos;il prend en charge [À COMPLÉTER : liste et pays].</li>
        <li>Les autorités, sur demande légalement fondée.</li>
      </ul>

      <H2 id="transferts">Transferts hors de l&apos;Union européenne</H2>
      <p>
        Les transactions avec l&apos;Algérie impliquent la transmission de certaines données (nom, adresse de livraison, téléphone) à des destinataires situés en Algérie, pays qui ne bénéficie pas d&apos;une décision
        d&apos;adéquation de la Commission européenne. [À VALIDER : garanties appropriées (clauses contractuelles types), information des membres, et respect de la loi algérienne n° 18-07 relative à la protection des personnes
        physiques dans le traitement des données à caractère personnel.]
      </p>

      <H2 id="cookies">Cookies et stockage local</H2>
      <p>
        Nous n&apos;utilisons que des éléments <strong>strictement nécessaires</strong> : le cookie de session (connexion), la mémorisation du thème d&apos;affichage et de vos dernières recherches dans votre navigateur. Aucun cookie
        publicitaire ni de mesure d&apos;audience tierce n&apos;est déposé ; c&apos;est pourquoi aucun bandeau de consentement n&apos;est affiché. [À VALIDER si des outils tiers sont ajoutés.]
      </p>

      <H2 id="securite">Sécurité</H2>
      <p>Mots de passe hachés, double authentification, chiffrement des échanges, contrôle d&apos;accès par rôle, journal d&apos;audit des consultations de données par l&apos;équipe, photos nettoyées de leurs métadonnées.</p>

      <H2 id="droits">Vos droits</H2>
      <p>
        Vous disposez des droits d&apos;accès, de rectification, d&apos;effacement, de limitation, d&apos;opposition et de portabilité. Vous pouvez modifier votre profil et supprimer votre compte depuis les{" "}
        <Link href="/compte/parametres">paramètres</Link> ; pour les autres demandes, consultez la page <Link href="/contact">contact</Link>. Vous pouvez introduire une réclamation auprès de la CNIL (France) ou de
        l&apos;autorité nationale compétente (Algérie : ANPDP).
      </p>
    </ContentPage>
  );
}
