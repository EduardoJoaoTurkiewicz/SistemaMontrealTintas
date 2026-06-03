/**
 * Three-field financial amount model:
 *   principal_amount + charges = final_amount
 *
 * "charges" covers notary fees, interest, discounts, cartório costs —
 * anything that adjusts the principal before settlement. They are stored
 * separately so they are never double-deducted or silently absorbed.
 */

/** Returns true when principal + charges reconciles to final within R$0.01. */
export function validateFinancialAmounts(
  principal: number,
  charges: number,
  final: number
): boolean {
  return Math.abs(principal + charges - final) < 0.01;
}

/** Canonical derivation of final_amount from its components. */
export function computeFinalAmount(principal: number, charges: number): number {
  return principal + charges;
}
