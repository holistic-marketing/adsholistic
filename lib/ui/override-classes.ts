/**
 * Une las clases de fábrica de un componente con las que le pasa quien lo usa.
 * Si quien lo usa trae su propio relleno, margen, tamaño, separación o radio,
 * se descartan los de fábrica de esa misma familia (y del mismo breakpoint).
 * Sin esto, `p-0` no le gana a `px-4`: Tailwind ordena por valor, no por orden.
 */
const FAMILIES: Array<[string, RegExp]> = [
  ["padding", /^p[xytrblse]?-/],
  ["margin", /^-?m[xytrblse]?-/],
  ["size", /^(size|w|h|min-w|min-h|max-w|max-h)-/],
  ["gap", /^gap(-[xy])?-/],
  ["radius", /^rounded(-[a-z]+)?(-|$)/],
];

function familyOf(token: string): string | null {
  const cut = token.lastIndexOf(":");
  const variant = cut === -1 ? "" : token.slice(0, cut + 1);
  const utility = (cut === -1 ? token : token.slice(cut + 1)).replace(/!$/, "");
  for (const [name, re] of FAMILIES) if (re.test(utility)) return variant + name;
  return null;
}

export function overrideClasses(base: string, override?: string | false | null): string {
  if (!override) return base;
  const taken = new Set(override.split(/\s+/).map(familyOf).filter(Boolean));
  const kept = base.split(/\s+/).filter((token) => {
    const family = familyOf(token);
    return !family || !taken.has(family);
  });
  return `${kept.join(" ")} ${override}`.trim();
}
