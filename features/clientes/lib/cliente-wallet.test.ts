import assert from "node:assert/strict";
import test from "node:test";
import {
  clienteWalletCents,
  pickClienteWalletOrganizationId,
  walletBalanceIsUnknown,
} from "./cliente-wallet.ts";

test("la cartera es la del cliente, no la del gerente que está viendo como", () => {
  assert.equal(
    pickClienteWalletOrganizationId("org-cliente", "org-gerente"),
    "org-cliente",
  );
  assert.equal(
    pickClienteWalletOrganizationId("  org-cliente  ", "org-gerente"),
    "org-cliente",
  );
});

test("si el cliente no tiene org propia, usa la de la sesión", () => {
  assert.equal(pickClienteWalletOrganizationId(null, "org-sesion"), "org-sesion");
  assert.equal(pickClienteWalletOrganizationId("  ", "org-sesion"), "org-sesion");
  assert.equal(pickClienteWalletOrganizationId(null, "  "), null);
});

test("un saldo leído en cero es cero; una lectura fallida no lo es", () => {
  assert.equal(clienteWalletCents({ availableBalanceCents: 0 }), 0);
  assert.equal(clienteWalletCents({ availableBalanceCents: 1250 }), 1250);
  assert.equal(clienteWalletCents({ availableBalanceCents: null }), 0);
  assert.equal(walletBalanceIsUnknown(null), true);
  assert.equal(walletBalanceIsUnknown(undefined), true);
  assert.equal(walletBalanceIsUnknown(0), false);
});
