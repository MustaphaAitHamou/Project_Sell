/**
 * Cycle de vie d'une annonce. Les transitions SYSTEM (réservation, vente, remise en
 * vente après annulation) sont déclenchées uniquement par le service de commandes,
 * dans la même transaction que la mise à jour de quantité disponible.
 */
export const LISTING_STATUSES = [
  "DRAFT",
  "PENDING_REVIEW",
  "ACTIVE",
  "RESERVED",
  "SOLD",
  "SUSPENDED",
  "REJECTED",
  "ARCHIVED",
  "DELETED",
] as const;
export type ListingState = (typeof LISTING_STATUSES)[number];
export type ListingActor = "SELLER" | "MODERATOR" | "SYSTEM";

type Edges = Partial<Record<ListingState, readonly ListingActor[]>>;

export const LISTING_TRANSITIONS: Record<ListingState, Edges> = {
  DRAFT: { PENDING_REVIEW: ["SELLER"], ACTIVE: ["SELLER"], DELETED: ["SELLER"] },
  PENDING_REVIEW: { ACTIVE: ["MODERATOR"], REJECTED: ["MODERATOR"], DRAFT: ["SELLER"], DELETED: ["SELLER", "MODERATOR"] },
  REJECTED: { DRAFT: ["SELLER"], PENDING_REVIEW: ["SELLER"], DELETED: ["SELLER"] },
  ACTIVE: {
    RESERVED: ["SYSTEM"],
    SOLD: ["SYSTEM"],
    ARCHIVED: ["SELLER"],
    SUSPENDED: ["MODERATOR"],
    DELETED: ["SELLER", "MODERATOR"],
    PENDING_REVIEW: ["SYSTEM"],
  },
  RESERVED: { ACTIVE: ["SYSTEM"], SOLD: ["SYSTEM"], SUSPENDED: ["MODERATOR"] },
  SOLD: { ACTIVE: ["SYSTEM"], RESERVED: ["SYSTEM"], ARCHIVED: ["SELLER"] },
  SUSPENDED: { ACTIVE: ["MODERATOR"], DELETED: ["SELLER", "MODERATOR"] },
  ARCHIVED: { ACTIVE: ["SELLER"], PENDING_REVIEW: ["SELLER"], DELETED: ["SELLER"] },
  DELETED: {},
};

export class ListingTransitionError extends Error {
  constructor(
    public readonly from: ListingState,
    public readonly to: ListingState,
    public readonly actor: ListingActor,
  ) {
    super(`Transition d'annonce interdite : ${from} → ${to} (${actor})`);
    this.name = "ListingTransitionError";
  }
}

export function canTransitionListing(from: ListingState, to: ListingState, actor: ListingActor): boolean {
  return LISTING_TRANSITIONS[from][to]?.includes(actor) ?? false;
}

export function assertListingTransition(from: ListingState, to: ListingState, actor: ListingActor): void {
  if (!canTransitionListing(from, to, actor)) throw new ListingTransitionError(from, to, actor);
}

/** Annonces visibles publiquement (recherche : ACTIVE uniquement ; fiche : aussi réservée/vendue). */
export const PUBLIC_LISTING_STATES: readonly ListingState[] = ["ACTIVE", "RESERVED", "SOLD"];
/** États dans lesquels le vendeur peut modifier le contenu de son annonce. */
export const EDITABLE_LISTING_STATES: readonly ListingState[] = ["DRAFT", "PENDING_REVIEW", "REJECTED", "ACTIVE", "ARCHIVED"];
/** Champs dont la modification sur une annonce active renvoie en modération si la catégorie l'exige. */
export const SENSITIVE_LISTING_FIELDS = ["title", "description", "categoryId", "images"] as const;

/** Statut après demande de publication : modération préalable ou publication directe. */
export function publicationTarget(opts: { categoryRequiresReview: boolean; sellerRequiresReview: boolean }): ListingState {
  return opts.categoryRequiresReview || opts.sellerRequiresReview ? "PENDING_REVIEW" : "ACTIVE";
}
