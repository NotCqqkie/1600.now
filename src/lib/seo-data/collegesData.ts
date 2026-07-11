import rawColleges from "@/data/colleges.json";

export interface College {
  id: number;
  slug: string;
  name: string;
  alias: string | null;
  aliases: string[];
  city: string | null;
  state: string | null;
  zip: string | null;
  url: string | null;
  ownership: string;
  carnegieBasic: number | null;
  enrollment: number | null;
  acceptanceRate: number | null;
  sat25: number | null;
  sat75: number | null;
  satMid: number | null;
  satRwMid: number | null;
  satMathMid: number | null;
  act25: number | null;
  act75: number | null;
  tuitionIn: number | null;
  tuitionOut: number | null;
  earnings10yr: number | null;
  completionRate: number | null;
}

type RawCollege = Omit<College, "aliases">;

const collegeAliases = (alias: string | null): string[] =>
  alias
    ? [...new Set(alias.split(/[|;]/).map((item) => item.trim()).filter(Boolean))]
    : [];

export const colleges: College[] = (rawColleges as RawCollege[]).map((college) => {
  const aliases = collegeAliases(college.alias);
  return {
    ...college,
    alias: aliases[0] ?? null,
    aliases,
  };
});

export const COLLEGE_SCORECARD_PROVENANCE = {
  sourceName: "US Department of Education College Scorecard",
  documentationVersion: "September 2025",
  snapshotImportedOn: "April 25, 2026",
  documentationUrl: "https://collegescorecard.ed.gov/files/InstitutionDataDocumentation.pdf",
  directoryUrl: "https://collegescorecard.ed.gov/",
} as const;

export const normalizeSatScore = (score: number): number =>
  Math.min(1600, Math.max(400, Math.round(score / 10) * 10));

export const getRecommendedSatScore = (college: College): number | null =>
  college.sat75 == null ? null : Math.min(1600, normalizeSatScore(college.sat75) + 40);

export const collegeBySlug = new Map(colleges.map((college) => [college.slug, college]));

export const isSitemapEligible = (college: College): boolean =>
  Boolean(college.sat25 && college.sat75 && college.acceptanceRate != null);

export const sitemapEligibleColleges = colleges.filter(isSitemapEligible);

export const formatUsd = (n: number | null): string =>
  n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`;

export const formatPct = (n: number | null): string =>
  n == null ? "—" : `${Math.round(n * 100)}%`;
