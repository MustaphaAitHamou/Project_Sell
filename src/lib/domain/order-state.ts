/**
 * Machine à états des commandes. Toute transition passe par `assertOrderTransition`
 * côté serveur (service `server/services/orders`), puis par un UPDATE conditionnel
 * (`WHERE status = <from> AND version = <v>`) et une ligne d'historique immuable.
 *
 * Acteurs :
 * - BUYER / SELLER : parties de la commande, authentifiées, sur leur propre commande ;
 * - SYSTEM : webhook prestataire à signature vérifiée, tâche planifiée, service interne ;
 * - STAFF : personnel habilité (permission vérifiée séparément), action auditée.
 *
 * Une commande ne peut jamais être déclarée livrée par le vendeur seul : la livraison
 * provient d'un événement transporteur vérifié (SYSTEM), d'un code de remise saisi
 * correctement (SYSTEM), de la confirmation de l'acheteur, ou d'une décision du personnel.
 */
export const ORDER_STATUSES = [
  "CREATED",
  "PAYMENT_PENDING",
  "PAID",
  "SHIPPING_PENDING",
  "READY_TO_SHIP",
  "IN_TRANSIT",
  "DELIVERED",
  "DISPUTE_WINDOW",
  "COMPLETED",
  "CANCELLED",
  "REFUND_PENDING",
  "REFUNDED",
  "DISPUTED",
] as const;
export type OrderState = (typeof ORDER_STATUSES)[number];
export type OrderActor = "BUYER" | "SELLER" | "SYSTEM" | "STAFF";

type Edges = Partial<Record<OrderState, readonly OrderActor[]>>;

export const ORDER_TRANSITIONS: Record<OrderState, Edges> = {
  CREATED: { PAYMENT_PENDING: ["SYSTEM"], CANCELLED: ["BUYER", "SYSTEM", "STAFF"] },
  PAYMENT_PENDING: { PAID: ["SYSTEM"], CANCELLED: ["BUYER", "SYSTEM", "STAFF"] },
  PAID: { SHIPPING_PENDING: ["SYSTEM"], REFUND_PENDING: ["SELLER", "SYSTEM", "STAFF"], DISPUTED: ["STAFF"] },
  SHIPPING_PENDING: {
    READY_TO_SHIP: ["SYSTEM"],
    // Remise en main propre : livraison constatée par la saisie du code de l'acheteur.
    DELIVERED: ["SYSTEM", "STAFF"],
    REFUND_PENDING: ["SELLER", "SYSTEM", "STAFF"],
    DISPUTED: ["BUYER", "STAFF"],
  },
  READY_TO_SHIP: { IN_TRANSIT: ["SYSTEM"], REFUND_PENDING: ["SELLER", "SYSTEM", "STAFF"], DISPUTED: ["BUYER", "STAFF"] },
  IN_TRANSIT: { DELIVERED: ["SYSTEM", "BUYER", "STAFF"], DISPUTED: ["BUYER", "STAFF"] },
  DELIVERED: { DISPUTE_WINDOW: ["SYSTEM"] },
  DISPUTE_WINDOW: { COMPLETED: ["BUYER", "SYSTEM", "STAFF"], DISPUTED: ["BUYER", "STAFF"] },
  COMPLETED: {},
  CANCELLED: {},
  REFUND_PENDING: { REFUNDED: ["SYSTEM"], COMPLETED: ["SYSTEM"] },
  REFUNDED: {},
  // Sortie de litige : décision du personnel, ou retrait du litige par l'acheteur.
  DISPUTED: {
    REFUND_PENDING: ["STAFF"],
    COMPLETED: ["STAFF"],
    SHIPPING_PENDING: ["STAFF", "BUYER"],
    READY_TO_SHIP: ["STAFF", "BUYER"],
    IN_TRANSIT: ["STAFF", "BUYER"],
    DISPUTE_WINDOW: ["STAFF", "BUYER"],
  },
};

export class OrderTransitionError extends Error {
  constructor(
    public readonly from: OrderState,
    public readonly to: OrderState,
    public readonly actor: OrderActor,
  ) {
    super(`Transition de commande interdite : ${from} → ${to} (${actor})`);
    this.name = "OrderTransitionError";
  }
}

export function canTransitionOrder(from: OrderState, to: OrderState, actor: OrderActor): boolean {
  return ORDER_TRANSITIONS[from][to]?.includes(actor) ?? false;
}

export function assertOrderTransition(from: OrderState, to: OrderState, actor: OrderActor): void {
  if (!canTransitionOrder(from, to, actor)) throw new OrderTransitionError(from, to, actor);
}

export const ORDER_TERMINAL_STATES: readonly OrderState[] = ["COMPLETED", "CANCELLED", "REFUNDED"];
/** États où l'acheteur a payé et où les fonds ne lui ont pas été restitués ni reversés. */
export const ORDER_FUNDS_HELD_STATES: readonly OrderState[] = [
  "PAID",
  "SHIPPING_PENDING",
  "READY_TO_SHIP",
  "IN_TRANSIT",
  "DELIVERED",
  "DISPUTE_WINDOW",
  "DISPUTED",
  "REFUND_PENDING",
];
/** États depuis lesquels l'acheteur peut ouvrir un litige. */
export const ORDER_DISPUTABLE_STATES: readonly OrderState[] = ["SHIPPING_PENDING", "READY_TO_SHIP", "IN_TRANSIT", "DISPUTE_WINDOW"];
/** Annulation (avec remboursement le cas échéant) possible avant l'expédition. */
export const ORDER_PRE_SHIPMENT_STATES: readonly OrderState[] = ["CREATED", "PAYMENT_PENDING", "PAID", "SHIPPING_PENDING", "READY_TO_SHIP"];
/** Commandes encore « en cours » (affichage, tableaux de bord). */
export const ORDER_ACTIVE_STATES: readonly OrderState[] = ORDER_STATUSES.filter((s) => !ORDER_TERMINAL_STATES.includes(s));

/** Ordre des étapes affichées dans la frise de suivi. */
export const ORDER_TIMELINE: readonly OrderState[] = ["PAID", "SHIPPING_PENDING", "IN_TRANSIT", "DELIVERED", "COMPLETED"];
