import { CheckCircle2, CircleDashed, FlaskConical, Lock } from "lucide-react";
import type { Metadata } from "next";
import { ContentPage, H2 } from "@/components/layout/content-page";
import { Link } from "@/i18n/navigation";
import { env } from "@/lib/env";
import { db } from "@/server/db/client";
import { getPublicFacts } from "@/server/services/public-facts";
import { isEnabled } from "@/server/settings";

export const metadata: Metadata = {
  title: "Comment ça marche",
  description: "Acheter et vendre sur Tamurt Market : publication, messagerie, paiement protégé, frais de protection acheteur, livraison et état réel du service.",
  alternates: { canonical: "/comment-ca-marche" },
};

type State = "operational" | "simulation" | "unavailable" | "closed";
const STATE: Record<State, { label: string; icon: typeof CheckCircle2; className: string }> = {
  operational: { label: "Opérationnel", icon: CheckCircle2, className: "text-success" },
  simulation: { label: "Simulation (aucune transaction réelle)", icon: FlaskConical, className: "text-warning" },
  unavailable: { label: "Non disponible", icon: CircleDashed, className: "text-muted-foreground" },
  closed: { label: "Fermé jusqu'à validation juridique", icon: Lock, className: "text-muted-foreground" },
};

export default async function HowItWorksPage() {
  const [facts, crossBorder, dz] = await Promise.all([getPublicFacts(), isEnabled("checkout.crossBorder"), db.country.findUnique({ where: { code: "DZ" }, select: { checkoutMode: true } })]);
  const payments: State = env.PAYMENT_PROVIDER === "sandbox" ? "simulation" : "unavailable";
  const transport: State = env.TRANSPORT_INTEGRATION === "simulator" ? "simulation" : env.TRANSPORT_INTEGRATION === "disabled" ? "unavailable" : "operational";
  const rows: { feature: string; state: State; note: string }[] = [
    { feature: "Annonces, recherche, favoris", state: "operational", note: "Publication en 5 étapes, photos nettoyées de leurs métadonnées (dont la position GPS)." },
    { feature: "Messagerie entre membres", state: "operational", note: "Coordonnées masquées, détection des tentatives d'arnaque, blocage et signalement." },
    { feature: "Paiement protégé (France)", state: payments, note: payments === "simulation" ? "Prestataire de paiement de test : aucun débit réel." : "Aucun prestataire de paiement n'est encore contractualisé." },
    { feature: "Versements aux vendeurs", state: payments === "simulation" ? "simulation" : "unavailable", note: "Exigent un prestataire agréé et la vérification d'identité du vendeur." },
    { feature: "Remise en main propre avec code", state: "operational", note: "Le vendeur saisit le code à 6 chiffres de l'acheteur au moment de la remise." },
    { feature: "Livraison nationale (France)", state: "simulation", note: "Aucun transporteur n'est encore contractualisé ; étiquettes et suivi simulés." },
    { feature: "Tamurt Transport (France ⇄ Algérie)", state: transport, note: "L'intégration repose sur un contrat d'API proposé ; Tamurt Transport n'expose pas encore d'API partenaire." },
    { feature: "Achat intégré en Algérie", state: dz?.checkoutMode === "INTEGRATED" ? "operational" : "unavailable", note: "Mode petites annonces : aucune solution de paiement pour place de marché n'est disponible à ce jour." },
    { feature: "Achats entre pays", state: crossBorder ? "operational" : "closed", note: "Douane, fiscalité et paiement doivent être validés par des professionnels avant ouverture." },
  ];
  return (
    <ContentPage
      title="Comment ça marche"
      intro="Tamurt Market met en relation acheteurs et vendeurs, particuliers ou professionnels, en France et en Algérie. Voici le parcours, les frais et l'état réel de chaque service."
      toc={[
        { id: "acheter", label: "Acheter" },
        { id: "vendre", label: "Vendre" },
        { id: "frais", label: "Frais" },
        { id: "livraison", label: "Livraison" },
        { id: "transport", label: "Tamurt Transport" },
        { id: "etat-du-service", label: "État du service" },
      ]}
    >
      <H2 id="acheter">Acheter</H2>
      <ul>
        <li>
          <strong>Trouvez</strong> un article par la recherche (fautes de frappe et graphies kabyles ou arabes latinisées tolérées) ou par catégorie.
        </li>
        <li>
          <strong>Posez vos questions</strong> au vendeur dans la messagerie : ne communiquez jamais vos coordonnées bancaires et ne payez jamais en dehors de la plateforme.
        </li>
        <li>
          <strong>Payez</strong> sur Tamurt Market lorsque l&apos;achat intégré est disponible : le montant est conservé jusqu&apos;à la réception, puis versé au vendeur.
        </li>
        <li>
          <strong>Vérifiez</strong> l&apos;article : vous disposez de {facts.disputeWindowHours} heures après la remise ou la livraison pour signaler un problème. Sans signalement, la vente est conclue.
        </li>
      </ul>

      <H2 id="vendre">Vendre</H2>
      <ul>
        <li>Publiez une annonce en cinq étapes : catégorie, photos, description, prix et livraison, vérification.</li>
        <li>Certaines catégories (puériculture, beauté, monnaies et billets de collection…) et certains mots-clés déclenchent une vérification humaine avant la mise en ligne.</li>
        <li>Lorsqu&apos;un acheteur paie, l&apos;article est réservé : vous remettez l&apos;article en main propre ou l&apos;expédiez sous {facts.shipWithinDays} jours.</li>
        <li>Vous recevez le prix affiché de votre article, sans commission vendeur à ce jour.</li>
      </ul>

      <H2 id="frais">Frais</H2>
      <p>
        Des <strong>frais de protection acheteur de {facts.feePercent} %</strong> du prix de l&apos;article s&apos;ajoutent au prix payé par l&apos;acheteur. Exemple : pour un article à {facts.example.price}, l&apos;acheteur paie {facts.example.price} + {facts.example.fee} ={" "}
        <strong>{facts.example.total}</strong> (hors livraison) et le vendeur reçoit <strong>{facts.example.seller}</strong>.
      </p>
      <p>Les montants sont calculés par nos serveurs, en centimes, arrondis au centime le plus proche ; le détail est affiché avant le paiement et conservé avec la commande. Les frais de livraison s&apos;ajoutent séparément et ne sont jamais facturés deux fois.</p>

      <H2 id="livraison">Livraison</H2>
      <ul>
        <li>
          <strong>Remise en main propre</strong> : l&apos;acheteur montre son code de remise ; le vendeur le saisit pour confirmer. Ne remettez jamais un article contre une simple capture d&apos;écran de paiement.
        </li>
        <li>
          <strong>Livraison nationale</strong> : tarif selon le format du colis, étiquette générée par la plateforme, suivi intégré.
        </li>
        <li>
          <strong>Tamurt Transport</strong> : envoi entre la France et l&apos;Algérie par des voyageurs vérifiés de l&apos;écosystème Tamurt.
        </li>
      </ul>

      <H2 id="transport">Tamurt Transport</H2>
      <p>
        Tamurt Transport est le service de transport collaboratif de l&apos;écosystème Tamurt Services. Il fonctionne de façon indépendante : Tamurt Market lui demande un devis et réserve une capacité pour votre colis, mais une
        indisponibilité de Tamurt Transport n&apos;empêche jamais d&apos;utiliser la marketplace.
      </p>
      <p>
        <strong>État actuel :</strong> l&apos;interface entre les deux services est définie mais Tamurt Transport n&apos;expose pas encore d&apos;API partenaire ; les devis affichés proviennent d&apos;un simulateur et les achats entre la France et
        l&apos;Algérie restent fermés tant que les aspects douaniers, fiscaux et de paiement n&apos;ont pas été validés.
      </p>

      <H2 id="etat-du-service">État du service</H2>
      <div className="not-prose overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-subtle text-xs text-muted-foreground uppercase">
            <tr>
              <th scope="col" className="px-3 py-2 text-start">
                Fonction
              </th>
              <th scope="col" className="px-3 py-2 text-start">
                État
              </th>
              <th scope="col" className="px-3 py-2 text-start">
                Précision
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const s = STATE[r.state];
              return (
                <tr key={r.feature} className="border-t border-border align-top">
                  <td className="px-3 py-2.5 font-medium text-foreground">{r.feature}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center gap-1.5 font-semibold ${s.className}`}>
                      <s.icon className="size-4" aria-hidden /> {s.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.note}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p>
        Des questions ? Consultez le <Link href="/centre-aide">centre d&apos;aide</Link> ou la page <Link href="/protection-acheteur">protection acheteur</Link>.
      </p>
    </ContentPage>
  );
}
