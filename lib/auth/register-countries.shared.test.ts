import assert from "node:assert/strict";
import test from "node:test";
import { getCountries } from "libphonenumber-js/min";
import {
  REGISTER_COUNTRIES,
  getRegisterCountry,
  isRegisterCountry,
  isValidDoc,
  isValidPhone,
  localPhoneDigits,
  normalizeDoc,
  storedDoc,
  storedPhone,
} from "./register-countries.shared.ts";

test("registration offers every supported country, localized and Peru first", () => {
  assert.deepEqual(REGISTER_COUNTRIES.map((rule) => rule.code).sort(), getCountries().sort());
  assert.ok(REGISTER_COUNTRIES.length > 200);
  assert.equal(REGISTER_COUNTRIES[0]?.code, "PE");
  const remaining = REGISTER_COUNTRIES.slice(1).map((rule) => rule.name.es);
  assert.deepEqual(remaining, [...remaining].sort((a, b) => a.localeCompare(b, "es")));
  for (const country of REGISTER_COUNTRIES) {
    assert.match(country.dial, /^\d{1,3}$/);
    for (const language of ["es", "en", "pt", "zh"] as const) {
      assert.ok(country.name[language].length > 0, `${country.code}: ${language}`);
    }
  }
  assert.equal(getRegisterCountry("CO").dial, "57");
  assert.equal(getRegisterCountry("GB").dial, "44");
  assert.equal(getRegisterCountry("JP").name.es, "Japón");
});

test("only an absent legacy country defaults to Peru", () => {
  assert.equal(getRegisterCountry(undefined).code, "PE");
  assert.equal(getRegisterCountry(null).code, "PE");
  for (const invalid of ["", "ZZ", "co", " CO", "constructor"]) {
    assert.equal(isRegisterCountry(invalid), false);
    assert.throws(() => getRegisterCountry(invalid), /country/);
  }
  for (const invalid of [undefined, null, 57, {}, ["CO"]]) {
    assert.equal(isRegisterCountry(invalid), false);
  }
  for (const code of ["PE", "CO", "GB", "US", "JP", "XK"]) {
    assert.equal(isRegisterCountry(code), true);
  }
});

test("national, plus and 00 international formats produce the same E.164 phone", () => {
  for (const [code, inputs, expected] of [
    ["PE", ["987 654 321", "+51 987 654 321", "0051 987654321", "51987654321"], "+51987654321"],
    ["CO", ["300 123 4567", "+57 (300) 123-4567", "00 57 3001234567", "573001234567"], "+573001234567"],
    ["EC", ["099 123 4567", "+593 99 123 4567"], "+593991234567"],
    ["BR", ["(11) 91234-5678", "+55 11 91234 5678"], "+5511912345678"],
    ["GB", ["07700 900123", "+44 7700 900123", "0044 7700 900123"], "+447700900123"],
    ["US", ["202 555 0123", "+1 (202) 555-0123"], "+12025550123"],
    ["ES", ["612 345 678", "+34 612 345 678"], "+34612345678"],
    ["JP", ["090-1234-5678", "+81 90 1234 5678"], "+819012345678"],
    ["CN", ["13800138000", "+86 13800138000"], "+8613800138000"],
    ["GH", ["020 123 4567", "+233 20 123 4567"], "+233201234567"],
    ["NZ", ["021 234 5678", "+64 21 234 5678"], "+64212345678"],
    ["AR", ["011 15 2345 6789", "+54 9 11 2345 6789"], "+5491123456789"],
  ] as const) {
    const country = getRegisterCountry(code);
    for (const input of inputs) {
      assert.equal(isValidPhone(country, input), true, `${code}: ${input}`);
      assert.equal(storedPhone(country, input), expected);
      assert.equal(storedPhone(country, expected), expected, "normalization must be idempotent");
    }
  }
});

test("phone normalization preserves significant zeros and ambiguous national prefixes", () => {
  const italy = getRegisterCountry("IT");
  assert.equal(storedPhone(italy, "02 3661 8300"), "+390236618300");
  assert.equal(localPhoneDigits(italy, "+39 02 3661 8300"), "0236618300");
  assert.equal(localPhoneDigits(getRegisterCountry("GB"), "020 7946 0018"), "2079460018");
  assert.equal(storedPhone(getRegisterCountry("DE"), "49123123456"), "+4949123123456");
  assert.equal(storedPhone(getRegisterCountry("ID"), "6221123456"), "+626221123456");
  // Shared calling codes must not be mistaken for an incompatible selection.
  assert.equal(storedPhone(getRegisterCountry("US"), "+1 416 555 0123"), "+14165550123");
});

test("phone validation rejects foreign calling codes, extensions, text and impossible lengths", () => {
  const colombia = getRegisterCountry("CO");
  for (const raw of [
    "", "   ", "300", "300123456", "300123456789", "+51 987654321", "0051987654321",
    "Call 3001234567", "3001234567abc", "3001234567 ext 12", "+573001234567;ext=12",
    "3001234567#12", "++573001234567", "57+3001234567", "+573001234567890123",
  ]) {
    assert.equal(isValidPhone(colombia, raw), false, raw);
    assert.equal(localPhoneDigits(colombia, raw), "", raw);
    assert.throws(() => storedPhone(colombia, raw), /phone/, raw);
  }
  assert.equal(isValidPhone(getRegisterCountry("DE"), "+49 12345678901234"), false);
});

test("existing numeric document rules and persisted identifiers remain compatible", () => {
  for (const [code, raw, normalized, stored] of [
    ["PE", "12345678", "12345678", "12345678"],
    ["CO", "1.234.567.890", "1234567890", "CO-1234567890"],
    ["EC", "0123456789", "0123456789", "EC-0123456789"],
    ["BR", "123.456.789-01", "12345678901", "BR-12345678901"],
  ] as const) {
    const country = getRegisterCountry(code);
    assert.equal(country.docNumeric, true);
    assert.equal(isValidDoc(country, raw), true);
    assert.equal(normalizeDoc(country, raw), normalized);
    assert.equal(storedDoc(country, raw), stored);
    assert.equal(isValidDoc(country, `${raw}a`), false, "letters must not be silently discarded");
    assert.equal(isValidDoc(country, normalized.slice(0, country.docMin - 1)), false);
    assert.equal(isValidDoc(country, "1".repeat(country.docMax + 1)), false);
    assert.throws(() => storedDoc(country, `${raw}a`), /document/);
  }
});

test("other countries accept alphanumeric identity documents and passports", () => {
  for (const code of ["ES", "GB", "US", "JP", "ZA", "AU"]) {
    const country = getRegisterCountry(code);
    assert.equal(country.docNumeric, false);
    assert.equal(isValidDoc(country, "ab-12 34.56"), true);
    assert.equal(storedDoc(country, "ab-12 34.56"), `${code}-AB123456`);
    assert.equal(isValidDoc(country, "A1B"), true);
    assert.equal(isValidDoc(country, "A".repeat(30)), true);
    for (const invalid of ["", "ab", "A".repeat(31), "ab_123", "ab<script>", "...---", "123🙂"]) {
      assert.equal(isValidDoc(country, invalid), false, `${code}: ${invalid}`);
    }
  }
});
