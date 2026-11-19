import assert from "node:assert/strict";
import test from "node:test";
import { overrideClasses } from "./override-classes.ts";

test("el relleno de quien usa el componente reemplaza al de fábrica", () => {
  assert.equal(overrideClasses("px-4 pb-4 pt-3 sm:px-6", "p-0"), "sm:px-6 p-0");
  assert.equal(overrideClasses("px-4 pb-4 sm:px-6 sm:pb-6", "sm:p-0"), "px-4 pb-4 sm:p-0");
});

test("el tamaño del ícono se puede cambiar", () => {
  assert.equal(overrideClasses("size-4 shrink-0", "size-3"), "shrink-0 size-3");
  assert.equal(overrideClasses("size-4 shrink-0", "h-5 w-5 text-ink"), "shrink-0 h-5 w-5 text-ink");
});

test("lo que no choca se suma", () => {
  assert.equal(overrideClasses("grid gap-1 p-5", "text-ink"), "grid gap-1 p-5 text-ink");
  assert.equal(overrideClasses("grid gap-1", undefined), "grid gap-1");
});
