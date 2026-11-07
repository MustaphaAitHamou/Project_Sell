import "server-only";
import { formatMoney } from "@/lib/domain/money";
import { computeOrderPricing } from "@/lib/domain/pricing";
import { getSetting } from "@/server/settings";
import { getActiveBuyerFeeRule } from "./fees";

/**
 * Valeurs réelles affichées dans les pages d'information (taux de frais, délais) : lues
 * dans la configuration plutôt que recopiées dans le texte, pour ne jamais annoncer un
 * chiffre différent de celui appliqué.
 */
export async function getPublicFacts() {
  const [rule, disputeWindowHours, sellerResponseHours, notReceivedAfterDays, shipWithinDays, handoverWithinDays] = await Promise.all([
    getActiveBuyerFeeRule("EUR"),
    getSetting("protection.disputeWindowHours"),
    getSetting("protection.sellerResponseHours"),
    getSetting("protection.notReceivedAfterDays"),
    getSetting("orders.shipWithinDays"),
    getSetting("orders.handoverWithinDays"),
  ]);
  const example = computeOrderPricing({ unitPrice: 5000, quantity: 1, currency: "EUR", buyerFeeRule: rule, sellerFeeRule: null, shipping: null });
  return {
    feePercent: (rule.rateBps / 100).toLocaleString("fr-FR"),
    example: { price: formatMoney(5000, "EUR"), fee: formatMoney(example.buyerFee, "EUR"), total: formatMoney(example.totalAmount, "EUR"), seller: formatMoney(example.sellerNetAmount, "EUR") },
    disputeWindowHours: Number(disputeWindowHours),
    sellerResponseHours: Number(sellerResponseHours),
    notReceivedAfterDays: Number(notReceivedAfterDays),
    shipWithinDays: Number(shipWithinDays),
    handoverWithinDays: Number(handoverWithinDays),
  };
}
