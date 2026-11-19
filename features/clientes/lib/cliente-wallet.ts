/**
 * Organización de la cartera que se muestra en el resumen.
 * Primero la del cliente seleccionado. La de la sesión solo si ese cliente
 * no tiene org propia (un gerente «viendo como» no debe imponer la suya).
 */
export function pickClienteWalletOrganizationId(
  resolvedClienteOrgId: string | null | undefined,
  sessionOrganizationId: string | null | undefined,
): string | null {
  const resolved = resolvedClienteOrgId?.trim() || null;
  if (resolved) return resolved;
  return sessionOrganizationId?.trim() || null;
}

/** Lectura terminada: sin fila de ledger el saldo real es 0. */
export function clienteWalletCents(input: {
  availableBalanceCents: number | null | undefined;
}): number {
  return input.availableBalanceCents ?? 0;
}

/** null no es cero: si la lectura falló se muestra «—» para no inventar un saldo. */
export function walletBalanceIsUnknown(
  walletBalanceCents: number | null | undefined,
): walletBalanceCents is null | undefined {
  return walletBalanceCents == null;
}
