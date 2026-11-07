import type { Metadata } from "next";
import { ContentPage, H2 } from "@/components/layout/content-page";

export const metadata: Metadata = { title: "Mentions légales", description: "Éditeur et hébergeur de Tamurt Market.", alternates: { canonical: "/mentions-legales" } };

export default function LegalNoticePage() {
  return (
    <ContentPage title="Mentions légales" draft>
      <H2 id="editeur">Éditeur</H2>
      <ul>
        <li>Raison sociale : [À COMPLÉTER]</li>
        <li>Forme juridique et capital social : [À COMPLÉTER]</li>
        <li>Siège social : [À COMPLÉTER]</li>
        <li>Immatriculation (RCS / SIREN) : [À COMPLÉTER]</li>
        <li>Numéro de TVA intracommunautaire : [À COMPLÉTER]</li>
        <li>Directeur ou directrice de la publication : [À COMPLÉTER]</li>
        <li>Contact : [À COMPLÉTER]</li>
      </ul>
      <H2 id="hebergeur">Hébergeur</H2>
      <p>[À COMPLÉTER : nom, adresse et téléphone de l&apos;hébergeur, une fois l&apos;infrastructure de production choisie.]</p>
      <H2 id="activite">Activité réglementée</H2>
      <p>
        Les paiements sont traités par [À COMPLÉTER : prestataire de services de paiement, numéro d&apos;agrément]. Tamurt Market n&apos;encaisse pas les fonds des acheteurs pour son propre compte. [À VALIDER : statut
        d&apos;intermédiaire au regard de la réglementation des services de paiement.]
      </p>
      <H2 id="propriete">Propriété intellectuelle</H2>
      <p>La marque, le logo et l&apos;interface de Tamurt Market sont la propriété de [À COMPLÉTER]. Les contenus publiés par les membres restent leur propriété.</p>
    </ContentPage>
  );
}
