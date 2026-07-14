
const FRACTION_RE = /^(-?)(\d+)\s*\/\s*(-?)(\d+)$/;
const DECIMAL_RE = /^-?(?:\d+\.?\d*|\.\d+)$/;

const normalizeText = (value: string): string =>
  value.toString().trim().toLowerCase().replace(/\s+/g, "");

type Rational = { num: number; den: number };

const toRational = (value: string): Rational | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const fractionMatch = trimmed.match(FRACTION_RE);
  if (fractionMatch) {
    const [, signA, numStr, signB, denStr] = fractionMatch;
    const den = Number.parseInt(denStr, 10);
    if (!Number.isFinite(den) || den === 0) return null;
    const num = Number.parseInt(numStr, 10);
    if (!Number.isFinite(num)) return null;
    const sign = (signA === "-" ? -1 : 1) * (signB === "-" ? -1 : 1);
    return { num: sign * num, den };
  }

  if (DECIMAL_RE.test(trimmed)) {
    const numericValue = Number.parseFloat(trimmed);
    if (!Number.isFinite(numericValue)) return null;
    const dotIndex = trimmed.indexOf(".");
    const decimals = dotIndex === -1 ? 0 : trimmed.length - dotIndex - 1;
    const scale = 10 ** decimals;
    return { num: Math.round(numericValue * scale), den: scale };
  }

  return null;
};

const rationalsEqual = (a: Rational, b: Rational): boolean =>
  a.num * b.den === b.num * a.den;

const decimalPlaceCount = (value: string): number => {
  const trimmed = value.trim();
  if (!DECIMAL_RE.test(trimmed)) return -1;
  const dotIndex = trimmed.indexOf(".");
  if (dotIndex === -1) return 0;
  return trimmed.length - dotIndex - 1;
};

const matchesSingleAccepted = (userRaw: string, acceptedRaw: string): boolean => {
  const user = userRaw.trim();
  const accepted = acceptedRaw.trim();
  if (!user || !accepted) return false;

  if (normalizeText(user) === normalizeText(accepted)) return true;

  const userRational = toRational(user);
  const acceptedRational = toRational(accepted);
  if (!userRational || !acceptedRational) return false;

  if (rationalsEqual(userRational, acceptedRational)) return true;
  const userDecimals = decimalPlaceCount(user);
  if (userDecimals < 1) return false;

  const acceptedValue = acceptedRational.num / acceptedRational.den;
  const userValue = userRational.num / userRational.den;
  const scale = 10 ** userDecimals;
  const rounded = Math.round(acceptedValue * scale) / scale;
  return Math.abs(rounded - userValue) < 1e-9;
};

export const answersEquivalent = (
  userAnswer: string | null | undefined,
  correctAnswer: string | null | undefined,
): boolean => {
  const user = (userAnswer ?? "").toString();
  const correct = (correctAnswer ?? "").toString();
  if (!user.trim() || !correct.trim()) return false;

  const acceptedForms = correct
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return acceptedForms.some((form) => matchesSingleAccepted(user, form));
};

export const formatAcceptedAnswers = (value: string | null | undefined): string => {
  const rawValue = (value ?? "").toString().trim();
  if (/^-?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(rawValue)) return rawValue;
  const forms = [...new Set(rawValue
    .toString()
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean))];
  if (forms.length < 2) return forms[0] ?? "";
  const first = forms[0];
  const equivalentAliases = forms.every((form) =>
    answersEquivalent(form, first) || answersEquivalent(first, form));
  if (equivalentAliases) {
    return forms.find((form) => /^-?\d+\s*\/\s*-?\d+$/.test(form)) ?? first;
  }
  if (forms.length === 2) return `${forms[0]} or ${forms[1]}`;
  return `${forms.slice(0, -1).join(", ")}, or ${forms[forms.length - 1]}`;
};
