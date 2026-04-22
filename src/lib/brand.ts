// Single source of truth for the 1600.now brand identity. Keeping display
// strings consistent across every page, meta tag, and JSON-LD payload is the
// core signal Google uses to recognize "1600.now" as a named entity. Do not
// vary the spelling anywhere — add new brand-adjacent strings here.

export const BRAND_NAME = "1600.now";
export const BRAND_ALTERNATE = "1600 Now";
export const BRAND_URL = "https://1600.now";
export const BRAND_LEGAL_NAME = "1600.now";

// Social profiles that should appear in the Organization.sameAs array. Add a
// URL here as soon as a handle is claimed — the exact URL ties the social
// account to the entity in Google's Knowledge Graph. Keep every handle as
// "1600now" or "the1600now" where possible so the naming pattern is
// unambiguous.
export const BRAND_SAME_AS: string[] = [
  // "https://x.com/1600now",
  // "https://www.instagram.com/1600now/",
  // "https://www.tiktok.com/@1600now",
  // "https://www.youtube.com/@1600now",
  // "https://www.linkedin.com/company/1600now/",
  // "https://www.reddit.com/user/1600now/",
  // "https://github.com/1600now",
  // "https://www.producthunt.com/products/1600-now",
  // "https://www.crunchbase.com/organization/1600-now",
];

// Appends "| 1600.now" to any page title that does not already mention the
// brand. The pipe+brand pattern trains Google that 1600.now is the site name.
// The homepage is exempt because its title already leads with the brand.
export const brandedTitle = (title: string) => {
  if (!title) return title;
  if (title.includes(BRAND_NAME)) return title;
  return `${title} | ${BRAND_NAME}`;
};
