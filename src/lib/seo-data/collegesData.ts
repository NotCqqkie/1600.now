import rawColleges from "@/data/colleges.json";

export interface College {
  id: number;
  slug: string;
  name: string;
  alias: string | null;
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

export const colleges: College[] = rawColleges as College[];

export const collegeBySlug = new Map(colleges.map((c) => [c.slug, c]));

export const collegesByState = (() => {
  const map = new Map<string, College[]>();
  for (const c of colleges) {
    if (!c.state) continue;
    const arr = map.get(c.state) ?? [];
    arr.push(c);
    map.set(c.state, arr);
  }
  return map;
})();

export const formatUsd = (n: number | null): string =>
  n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`;

export const formatPct = (n: number | null): string =>
  n == null ? "—" : `${Math.round(n * 100)}%`;
