import type { Metadata } from "next";
import { ContentPage, H2 } from "@/components/layout/content-page";
import { Link } from "@/i18n/navigation";
import { getPublicFacts } from "@/server/services/public-facts";

export const metadata: Metadata = {
  title: "Centre d'aide",
  description: "Questions fréquentes sur Tamurt Market : compte, annonces, paiement, frais, livraison, litiges, sécurité.",
  alternates: { canonical: "/centre-aide" },
};

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-lg border border-border bg-card px-4 py-3 [&_p]:my-2">
      <summary className="cursor-pointer list-none font-semibold text-foreground marker:hidden">
        <span className="me-2 inline-block transition-transform group-open:rotate-90" aria-hidden>
          ›
        </span>
        {q}
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

export default async function HelpPage() {
  const f = await getPublicFacts();
  return (
    <ContentPage
      title="Centre d'aide"
      intro="Les réponses aux questions les plus fréquentes. Pour un problème sur une commande, utilisez directement la page de la commande."
      toc={[
        { id: "compte", label: "Compte" },
        { id: "vendre", label: "Vendre" },
        { id: "acheter", label: "Acheter et payer" },
        { id: "livraison", label: "Livraison" },
        { id: "securite", label: "Sécurité" },
      ]}
    >
      <H2 id="compte">Compte</H2>
      <div className="grid gap-2">
        <Faq q="Pourquoi dois-je confirmer mon adresse e-mail ?">
          <p>La confirmation protège votre compte et limite les faux profils. Sans confirmation, vous ne pouvez ni publier, ni acheter, ni écrire aux vendeurs.</p>
        </Faq>
        <Faq q="Mon numéro de téléphone est-il visible ?">
          <p>Non. Votre téléphone et vos adresses ne sont jamais affichés publiquement. L&apos;adresse de livraison n&apos;est communiquée au vendeur qu&apos;après le paiement, pour l&apos;expédition.</p>
        </Faq>
        <Faq q="Comment supprimer mon compte ?">
          <p>
            Depuis <Link href="/compte/parametres">Paramètres</Link>. Les données personnelles sont anonymisées ; les informations liées aux transactions sont conservées pendant la durée imposée par la loi (comptabilité, litiges).
          </p>
        </Faq>
      </div>

      <H2 id="vendre">Vendre</H2>
      <div className="grid gap-2">
        <Faq q="Combien coûte la vente ?">
          <p>La publication est gratuite et il n&apos;y a pas de commission vendeur à ce jour : vous recevez le prix affiché. Les frais de protection sont payés par l&apos;acheteur.</p>
        </Faq>
        <Faq q="Pourquoi mon annonce est-elle « en vérification » ?">
          <p>
            Certaines catégories et certains mots-clés déclenchent une vérification humaine. Vous êtes notifié de la décision ; en cas de refus, le motif est indiqué. Voir les <Link href="/objets-interdits">objets interdits</Link>.
          </p>
        </Faq>
        <Faq q="Quand suis-je payé ?">
          <p>
            Après la remise de l&apos;article et la fin du délai de vérification de l&apos;acheteur ({f.disputeWindowHours} heures), ou dès qu&apos;il confirme la conformité. Un compte de versement vérifié est nécessaire.
            Pendant la phase de test, les versements sont simulés.
          </p>
        </Faq>
        <Faq q="Je suis professionnel : que dois-je faire ?">
          <p>Déclarez votre activité depuis votre profil (raison sociale, numéro d&apos;immatriculation). Un badge « Pro » informe les acheteurs, qui bénéficient alors des droits du Code de la consommation.</p>
        </Faq>
      </div>

      <H2 id="acheter">Acheter et payer</H2>
      <div className="grid gap-2">
        <Faq q="Pourquoi des frais s'ajoutent-ils au prix ?">
          <p>
            Les frais de protection acheteur ({f.feePercent} % du prix de l&apos;article) financent le paiement sécurisé et le traitement des litiges. Exemple : article à {f.example.price} → vous payez {f.example.total} hors
            livraison.
          </p>
        </Faq>
        <Faq q="Puis-je payer par virement ou en espèces ?">
          <p>
            Vous pouvez convenir d&apos;une remise en main propre payée sur la plateforme. Un paiement en dehors de Tamurt Market n&apos;est pas protégé : méfiez-vous des vendeurs qui le demandent et signalez-les.
          </p>
        </Faq>
        <Faq q="Pourquoi le bouton « Acheter » n'apparaît-il pas ?">
          <p>
            L&apos;achat intégré n&apos;est pas disponible partout : en Algérie, la marketplace fonctionne en petites annonces faute de solution de paiement adaptée ; les achats entre pays sont fermés tant que la conformité
            n&apos;est pas validée. Consultez l&apos;<Link href="/comment-ca-marche#etat-du-service">état du service</Link>.
          </p>
        </Faq>
        <Faq q="Comment signaler un problème sur une commande ?">
          <p>
            Depuis la page de la commande, avant la fin du délai de vérification. Voir la <Link href="/protection-acheteur">protection acheteur</Link>.
          </p>
        </Faq>
      </div>

      <H2 id="livraison">Livraison</H2>
      <div className="grid gap-2">
        <Faq q="Comment fonctionne la remise en main propre ?">
          <p>Après le paiement, l&apos;acheteur reçoit un code à 6 chiffres. Lors du rendez-vous, il vérifie l&apos;article puis donne le code au vendeur, qui le saisit pour confirmer la remise. Choisissez un lieu public.</p>
        </Faq>
        <Faq q="Qu'est-ce que Tamurt Transport ?">
          <p>
            Le service de transport collaboratif France ⇄ Algérie de l&apos;écosystème Tamurt. Son intégration est en préparation : <Link href="/comment-ca-marche#transport">en savoir plus</Link>.
          </p>
        </Faq>
      </div>

      <H2 id="securite">Sécurité</H2>
      <div className="grid gap-2">
        <Faq q="Comment reconnaître une arnaque ?">
          <p>
            Méfiez-vous d&apos;un prix anormalement bas, d&apos;une demande de paiement hors plateforme, d&apos;un lien vers un faux site de paiement ou d&apos;une demande de code reçu par SMS. Tamurt Market ne vous demandera jamais
            votre mot de passe ni vos coordonnées bancaires par message.
          </p>
        </Faq>
        <Faq q="Comment protéger mon compte ?">
          <p>
            Utilisez un mot de passe unique et activez la double authentification dans <Link href="/compte/parametres">Paramètres</Link>.
          </p>
        </Faq>
      </div>
      <p>
        Vous ne trouvez pas de réponse ? <Link href="/contact">Contactez-nous</Link>.
      </p>
    </ContentPage>
  );
}
