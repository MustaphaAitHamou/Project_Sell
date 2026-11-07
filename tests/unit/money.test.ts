import { describe, expect, it } from "vitest";
import { applyRateBps, formatMoney, minorToDecimalString, MoneyError, multiplyMinor, parseAmountToMinor, sumMinor } from "@/lib/domain/money";

describe("applyRateBps — arrondi entier demi vers le haut", () => {
  it("10 % de 50,00 € = 5,00 €", () => expect(applyRateBps(5000, 1000)).toBe(500));
  it("10 % de 10,05 € = 1,01 € (1,005 arrondi au centime supérieur)", () => expect(applyRateBps(1005, 1000)).toBe(101));
  it("10 % de 10,04 € = 1,00 €", () => expect(applyRateBps(1004, 1000)).toBe(100));
  it("10 % de 0,01 € = 0,00 €", () => expect(applyRateBps(1, 1000)).toBe(0));
  it("10 % de 0,05 € = 0,01 € (demi-centime arrondi vers le haut)", () => expect(applyRateBps(5, 1000)).toBe(1));
  it("taux nul", () => expect(applyRateBps(123456, 0)).toBe(0));
  it("exact sur les grands montants (aucune dérive flottante)", () => {
    expect(applyRateBps(999_999_999, 1000)).toBe(100_000_000);
    expect(applyRateBps(123_456_789, 1250)).toBe(15_432_099);
  });
  it("refuse un taux hors bornes ou non entier", () => {
    expect(() => applyRateBps(100, 5001)).toThrow(MoneyError);
    expect(() => applyRateBps(100, -1)).toThrow(MoneyError);
    expect(() => applyRateBps(100, 10.5)).toThrow(MoneyError);
  });
  it("refuse un montant non entier ou négatif", () => {
    expect(() => applyRateBps(10.5, 1000)).toThrow(MoneyError);
    expect(() => applyRateBps(-1, 1000)).toThrow(MoneyError);
  });
});

describe("parseAmountToMinor — saisie sans flottant", () => {
  it.each([
    ["50", 5000],
    ["50,5", 5050],
    ["50.05", 5005],
    ["1 200,99", 120099],
    ["0,10", 10],
    ["  12  ", 1200],
  ])("« %s » → %i", (input, expected) => expect(parseAmountToMinor(input, "EUR")).toBe(expected));
  it.each(["", "abc", "12,345", "-5", "1e3", "12..5", "99999999999"])("refuse « %s »", (input) =>
    expect(parseAmountToMinor(input, "EUR")).toBeNull(),
  );
  it("0,1 + 0,2 en unités mineures donne exactement 0,30", () => {
    expect(sumMinor(parseAmountToMinor("0,1", "EUR")!, parseAmountToMinor("0,2", "EUR")!)).toBe(30);
  });
});

describe("conversions et formatage", () => {
  it("chaîne décimale exacte", () => {
    expect(minorToDecimalString(5, "EUR")).toBe("0.05");
    expect(minorToDecimalString(123456, "EUR")).toBe("1234.56");
  });
  it("formatage français : décimales masquées si montant rond", () => {
    expect(formatMoney(5000, "EUR")).toMatch(/^50\s€$/u);
    expect(formatMoney(5050, "EUR")).toMatch(/^50,50\s€$/u);
    expect(formatMoney(1500000, "DZD")).toMatch(/^15\s000\sDA$/u);
  });
  it("multiplication contrôlée", () => {
    expect(multiplyMinor(1999, 3)).toBe(5997);
    expect(() => multiplyMinor(Number.MAX_SAFE_INTEGER, 2)).toThrow(MoneyError);
  });
  it("devise inconnue refusée", () => expect(() => formatMoney(100, "XXX")).toThrow(MoneyError));
});
