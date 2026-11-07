import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { Tx } from "@/server/db/client";

/**
 * Registre comptable TECHNIQUE en partie double (ce n'est pas la comptabilité légale,
 * tenue par l'expert-comptable à partir des exports). Chaque transaction est équilibrée
 * (débits = crédits, une seule devise) : vérifié ici puis par une contrainte différée en
 * base au COMMIT. Les écritures sont immuables (triggers) : une correction = une écriture
 * inverse. L'idempotence est garantie par une clé unique par transaction.
 *
 * Plan de comptes :
 * - psp_clearing           actif : fonds détenus chez le prestataire de paiement
 * - seller_payable         passif : montants dus aux vendeurs
 * - buyer_fee_deferred     passif : frais de protection encaissés, non encore acquis
 * - buyer_fee_revenue      produit : frais de protection acquis (commande terminée)
 * - seller_fee_deferred    passif : commission vendeur encaissée, non acquise
 * - seller_fee_revenue     produit : commission vendeur acquise
 * - shipping_payable       passif : montants dus au transporteur (ou à Tamurt Transport)
 * - tax_payable            passif : taxes collectées à reverser
 * - psp_fees               charge : frais du prestataire de paiement
 * - unallocated_receipts   passif : encaissements sans commande effective (paiement en
 *                          double ou tardif), soldés par leur remboursement automatique
 */
export const LEDGER_ACCOUNTS = [
  "psp_clearing",
  "seller_payable",
  "buyer_fee_deferred",
  "buyer_fee_revenue",
  "seller_fee_deferred",
  "seller_fee_revenue",
  "shipping_payable",
  "tax_payable",
  "psp_fees",
  "unallocated_receipts",
] as const;
export type LedgerAccount = (typeof LEDGER_ACCOUNTS)[number];

export type LedgerLine = { account: LedgerAccount; direction: "DEBIT" | "CREDIT"; amount: number };

export class LedgerImbalanceError extends Error {
  constructor(public readonly debit: number, public readonly credit: number) {
    super(`Écriture déséquilibrée : débits ${debit} ≠ crédits ${credit}`);
    this.name = "LedgerImbalanceError";
  }
}

export function assertBalanced(lines: LedgerLine[]) {
  const nonZero = lines.filter((l) => l.amount !== 0);
  for (const l of nonZero) if (!Number.isSafeInteger(l.amount) || l.amount < 0) throw new RangeError(`Montant d'écriture invalide : ${l.amount}`);
  const debit = nonZero.filter((l) => l.direction === "DEBIT").reduce((s, l) => s + l.amount, 0);
  const credit = nonZero.filter((l) => l.direction === "CREDIT").reduce((s, l) => s + l.amount, 0);
  if (debit !== credit || nonZero.length < 2) throw new LedgerImbalanceError(debit, credit);
  return nonZero;
}

/** Enregistre une transaction comptable ; sans effet si la clé d'idempotence existe déjà. */
export async function postLedger(
  tx: Tx,
  input: { orderId: string | null; kind: string; currency: string; idempotencyKey: string; description: string; lines: LedgerLine[]; occurredAt?: Date },
): Promise<{ id: string; duplicate: boolean }> {
  const lines = assertBalanced(input.lines);
  const existing = await tx.ledgerTransaction.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true } });
  if (existing) return { id: existing.id, duplicate: true };
  try {
    const t = await tx.ledgerTransaction.create({
      data: {
        orderId: input.orderId,
        kind: input.kind,
        currency: input.currency,
        idempotencyKey: input.idempotencyKey,
        description: input.description.slice(0, 300),
        occurredAt: input.occurredAt ?? new Date(),
        entries: { create: lines.map((l) => ({ account: l.account, direction: l.direction, amount: l.amount, currency: input.currency })) },
      },
      select: { id: true },
    });
    return { id: t.id, duplicate: false };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const again = await tx.ledgerTransaction.findUniqueOrThrow({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true } });
      return { id: again.id, duplicate: true };
    }
    throw e;
  }
}

/** Écritures types d'une commande (fonctions pures : testées unitairement). */
export const ledgerTemplates = {
  paymentCaptured(p: { total: number; sellerNet: number; sellerFee: number; buyerFee: number; shipping: number; tax: number }): LedgerLine[] {
    return [
      { account: "psp_clearing", direction: "DEBIT", amount: p.total },
      { account: "seller_payable", direction: "CREDIT", amount: p.sellerNet },
      { account: "seller_fee_deferred", direction: "CREDIT", amount: p.sellerFee },
      { account: "buyer_fee_deferred", direction: "CREDIT", amount: p.buyerFee },
      { account: "shipping_payable", direction: "CREDIT", amount: p.shipping },
      { account: "tax_payable", direction: "CREDIT", amount: p.tax },
    ];
  },
  pspFee(fee: number): LedgerLine[] {
    return [
      { account: "psp_fees", direction: "DEBIT", amount: fee },
      { account: "psp_clearing", direction: "CREDIT", amount: fee },
    ];
  },
  feesEarned(p: { buyerFee: number; sellerFee: number }): LedgerLine[] {
    return [
      { account: "buyer_fee_deferred", direction: "DEBIT", amount: p.buyerFee },
      { account: "buyer_fee_revenue", direction: "CREDIT", amount: p.buyerFee },
      { account: "seller_fee_deferred", direction: "DEBIT", amount: p.sellerFee },
      { account: "seller_fee_revenue", direction: "CREDIT", amount: p.sellerFee },
    ];
  },
  /** Remboursement intégral : chaque passif est soldé à hauteur de ce qui avait été encaissé. */
  fullRefund(p: { total: number; sellerNet: number; sellerFee: number; buyerFee: number; shipping: number; tax: number }): LedgerLine[] {
    return [
      { account: "seller_payable", direction: "DEBIT", amount: p.sellerNet },
      { account: "seller_fee_deferred", direction: "DEBIT", amount: p.sellerFee },
      { account: "buyer_fee_deferred", direction: "DEBIT", amount: p.buyerFee },
      { account: "shipping_payable", direction: "DEBIT", amount: p.shipping },
      { account: "tax_payable", direction: "DEBIT", amount: p.tax },
      { account: "psp_clearing", direction: "CREDIT", amount: p.total },
    ];
  },
  /** Remboursement partiel décidé en litige : imputé sur la part du vendeur. */
  partialRefund(amount: number): LedgerLine[] {
    return [
      { account: "seller_payable", direction: "DEBIT", amount },
      { account: "psp_clearing", direction: "CREDIT", amount },
    ];
  },
  payout(amount: number): LedgerLine[] {
    return [
      { account: "seller_payable", direction: "DEBIT", amount },
      { account: "psp_clearing", direction: "CREDIT", amount },
    ];
  },
  unallocatedReceipt(amount: number): LedgerLine[] {
    return [
      { account: "psp_clearing", direction: "DEBIT", amount },
      { account: "unallocated_receipts", direction: "CREDIT", amount },
    ];
  },
  unallocatedRefund(amount: number): LedgerLine[] {
    return [
      { account: "unallocated_receipts", direction: "DEBIT", amount },
      { account: "psp_clearing", direction: "CREDIT", amount },
    ];
  },
  shippingSettled(amount: number): LedgerLine[] {
    return [
      { account: "shipping_payable", direction: "DEBIT", amount },
      { account: "psp_clearing", direction: "CREDIT", amount },
    ];
  },
};
