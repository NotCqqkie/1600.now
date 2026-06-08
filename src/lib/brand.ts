
export const BRAND_NAME = "1600.now";
export const BRAND_ALTERNATE = "1600 Now";
export const BRAND_URL = "https://1600.now";
export const BRAND_LEGAL_NAME = "1600.now";
export const BRAND_SAME_AS: string[] = [
];
export const brandedTitle = (title: string) => {
  if (!title) return title;
  if (title.includes(BRAND_NAME)) return title;
  return `${title} | ${BRAND_NAME}`;
};
