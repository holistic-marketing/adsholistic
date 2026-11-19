import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/min";

/** Reglas compartidas por el formulario y la validación final del servidor. */
export type RegisterCountry = CountryCode;
type Lang = "es" | "en" | "pt" | "zh";
type L = Record<Lang, string>;

export type RegisterCountryRule = {
  code: RegisterCountry;
  name: L;
  /** Código telefónico sin «+». */
  dial: string;
  docLabel: L;
  docPlaceholder: L;
  docError: L;
  docNumeric: boolean;
  docMin: number;
  docMax: number;
  phoneMin: number;
  phoneMax: number;
  phonePlaceholder: string;
};

const LEGACY_COUNTRIES: RegisterCountryRule[] = [
  {
    code: "PE",
    name: { es: "Perú", en: "Peru", pt: "Peru", zh: "秘鲁" },
    dial: "51",
    docLabel: { es: "DNI", en: "DNI", pt: "DNI", zh: "DNI" },
    docPlaceholder: { es: "8 dígitos", en: "8 digits", pt: "8 dígitos", zh: "8 位数字" },
    docError: {
      es: "El DNI tiene 8 dígitos. No se acepta RUC ni pasaporte.",
      en: "The DNI has 8 digits. RUC or passport numbers are not accepted.",
      pt: "O DNI tem 8 dígitos. RUC ou passaporte não são aceitos.",
      zh: "DNI 为 8 位数字，不接受 RUC 或护照号。",
    },
    docNumeric: true,
    docMin: 8,
    docMax: 8,
    phoneMin: 9,
    phoneMax: 9,
    phonePlaceholder: "987 654 321",
  },
  {
    code: "CO",
    name: { es: "Colombia", en: "Colombia", pt: "Colômbia", zh: "哥伦比亚" },
    dial: "57",
    docLabel: { es: "Cédula de ciudadanía", en: "Citizenship ID (Cédula)", pt: "Cédula de cidadania", zh: "身份证（Cédula）" },
    docPlaceholder: { es: "6 a 10 dígitos", en: "6 to 10 digits", pt: "6 a 10 dígitos", zh: "6–10 位数字" },
    docError: {
      es: "La cédula tiene entre 6 y 10 dígitos.",
      en: "The cédula has 6 to 10 digits.",
      pt: "A cédula tem de 6 a 10 dígitos.",
      zh: "Cédula 为 6–10 位数字。",
    },
    docNumeric: true,
    docMin: 6,
    docMax: 10,
    phoneMin: 10,
    phoneMax: 10,
    phonePlaceholder: "300 123 4567",
  },
  {
    code: "EC",
    name: { es: "Ecuador", en: "Ecuador", pt: "Equador", zh: "厄瓜多尔" },
    dial: "593",
    docLabel: { es: "Cédula", en: "ID (Cédula)", pt: "Cédula", zh: "身份证（Cédula）" },
    docPlaceholder: { es: "10 dígitos", en: "10 digits", pt: "10 dígitos", zh: "10 位数字" },
    docError: {
      es: "La cédula tiene 10 dígitos.",
      en: "The cédula has 10 digits.",
      pt: "A cédula tem 10 dígitos.",
      zh: "Cédula 为 10 位数字。",
    },
    docNumeric: true,
    docMin: 10,
    docMax: 10,
    phoneMin: 9,
    phoneMax: 9,
    phonePlaceholder: "99 123 4567",
  },
  {
    code: "BR",
    name: { es: "Brasil", en: "Brazil", pt: "Brasil", zh: "巴西" },
    dial: "55",
    docLabel: { es: "CPF", en: "CPF", pt: "CPF", zh: "CPF" },
    docPlaceholder: { es: "11 dígitos", en: "11 digits", pt: "11 dígitos", zh: "11 位数字" },
    docError: {
      es: "El CPF tiene 11 dígitos.",
      en: "The CPF has 11 digits.",
      pt: "O CPF tem 11 dígitos.",
      zh: "CPF 为 11 位数字。",
    },
    docNumeric: true,
    docMin: 11,
    docMax: 11,
    phoneMin: 10,
    phoneMax: 11,
    phonePlaceholder: "11 91234 5678",
  },
];

const languages = ["es", "en", "pt", "zh"] as const;
const countryNames = Object.fromEntries(
  languages.map((language) => [language, new Intl.DisplayNames([language], { type: "region" })]),
) as Record<Lang, Intl.DisplayNames>;

const genericDocument = {
  docLabel: {
    es: "Documento de identidad o pasaporte",
    en: "Identity document or passport",
    pt: "Documento de identidade ou passaporte",
    zh: "身份证件或护照",
  },
  docPlaceholder: {
    es: "3 a 30 letras o números",
    en: "3 to 30 letters or numbers",
    pt: "3 a 30 letras ou números",
    zh: "3–30 个字母或数字",
  },
  docError: {
    es: "El documento debe tener entre 3 y 30 letras o números.",
    en: "The document must have 3 to 30 letters or numbers.",
    pt: "O documento deve ter de 3 a 30 letras ou números.",
    zh: "证件号码须包含 3–30 个字母或数字。",
  },
  docNumeric: false,
  docMin: 3,
  docMax: 30,
};

export const REGISTER_COUNTRIES: RegisterCountryRule[] = getCountries()
  .map((code) => {
    const dial = getCountryCallingCode(code);
    const legacyRule = LEGACY_COUNTRIES.find((country) => country.code === code);
    return {
      ...genericDocument,
      // Retained for presentation; actual phone validation uses the numbering plan.
      phoneMin: 4,
      phoneMax: 15 - dial.length,
      phonePlaceholder: `+${dial} …`,
      ...legacyRule,
      code,
      dial,
      name: Object.fromEntries(
        languages.map((language) => [language, countryNames[language].of(code) ?? code]),
      ) as L,
    };
  })
  .sort((a, b) => {
    if (a.code === "PE") return -1;
    if (b.code === "PE") return 1;
    return a.name.es.localeCompare(b.name.es, "es");
  });

const rulesByCountry = new Map(REGISTER_COUNTRIES.map((country) => [country.code, country]));

export function getRegisterCountry(code: string | null | undefined): RegisterCountryRule {
  const country = rulesByCountry.get((code ?? "PE") as RegisterCountry);
  if (!country) throw new Error("Unsupported registration country");
  return country;
}

export function isRegisterCountry(code: unknown): code is RegisterCountry {
  return typeof code === "string" && rulesByCountry.has(code as RegisterCountry);
}

export const onlyDigits = (v: string) => String(v ?? "").replace(/\D/g, "");

/** Parse the whole input, never a phone-like substring inside arbitrary text. */
function parseRegistrationPhone(country: RegisterCountryRule, raw: string) {
  if (typeof raw !== "string" || !/^\+?[\d\s().-]+$/.test(raw.trim())) return undefined;
  let input = raw.trim().replace(/[\s().-]/g, "");
  if (input.startsWith("00")) input = `+${input.slice(2)}`;
  const phone = parsePhoneNumberFromString(input, { defaultCountry: country.code, extract: false });
  if (
    !phone || phone.ext || phone.countryCallingCode !== country.dial ||
    !/^\+[1-9]\d{1,14}$/.test(phone.number) || !phone.isPossible()
  ) return undefined;
  return phone;
}

/** Número nacional normalizado; conserva ceros significativos como los de Italia. */
export function localPhoneDigits(country: RegisterCountryRule, raw: string): string {
  return parseRegistrationPhone(country, raw)?.nationalNumber ?? "";
}

/** Remove document formatting without silently discarding invalid letters/symbols. */
export function normalizeDoc(country: RegisterCountryRule, raw: string): string {
  const document = String(raw ?? "").replace(/[\s./-]/g, "");
  return country.docNumeric ? document : document.toUpperCase();
}

export function isValidDoc(country: RegisterCountryRule, raw: string): boolean {
  if (typeof raw !== "string") return false;
  const allowed = country.docNumeric ? /^[\d\s./-]+$/ : /^[a-zA-Z\d\s./-]+$/;
  if (!allowed.test(raw)) return false;
  const d = normalizeDoc(country, raw);
  return d.length >= country.docMin && d.length <= country.docMax;
}

export function isValidPhone(country: RegisterCountryRule, raw: string): boolean {
  return Boolean(parseRegistrationPhone(country, raw));
}

/** Cómo se guarda el documento en Hecom: Perú sin prefijo; el resto «CO-…». */
export function storedDoc(country: RegisterCountryRule, raw: string): string {
  if (!isValidDoc(country, raw)) throw new Error("Invalid registration document");
  const d = normalizeDoc(country, raw);
  return country.code === "PE" ? d : `${country.code}-${d}`;
}

export function storedPhone(country: RegisterCountryRule, raw: string): string {
  const phone = parseRegistrationPhone(country, raw);
  if (!phone) throw new Error("Invalid registration phone");
  return phone.number;
}
