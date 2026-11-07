import { notFound } from "next/navigation";

/** Toute URL inconnue sous une langue : page introuvable localisée (avec l'en-tête du site). */
export default function CatchAll() {
  notFound();
}
