// Shared free-response answer comparison.
//
// Accepts:
//   • exact text match (case/whitespace insensitive)
//   • equivalent fractions (1/4 ≡ 2/8 ≡ 15/60)
//   • decimal answers rounded to fewer places, down to 1 decimal place
//     (correct = 1.287 ⇒ 1.29, 1.3 also accepted; 1 is not)
//   • multiple comma-separated acceptable forms in the correct answer
//     (e.g. "-0.333,-1/3,-.3333")

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

  // Decimal rounding tolerance — only when the user's answer is a decimal with
  // at least one decimal place. Round the accepted value to the user's
  // precision and compare.
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
