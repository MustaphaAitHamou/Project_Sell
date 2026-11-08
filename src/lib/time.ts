/**
 * Horloge des composants serveur (rendu dynamique par requête) : centralisée pour pouvoir
 * être figée dans les tests et pour signaler explicitement la dépendance au temps.
 */
export const nowMs = () => Date.now();
export const daysAgo = (days: number) => new Date(nowMs() - days * 86_400_000);
