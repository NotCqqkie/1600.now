import { PreloadLink } from "@/components/PreloadLink";

const linkClassName = "hover:text-muted-foreground/70 hover:underline";

export const LegalDisclaimer = () => {
  return (
    <div className="flex flex-col items-center gap-1 px-4 pb-3 pt-1 sm:pb-4">
      <p className="pointer-events-none max-w-[42rem] rounded-full border border-border/30 bg-background/20 px-3 py-1 text-center text-[9px] leading-tight text-muted-foreground/45 shadow-sm backdrop-blur-[2px] select-none sm:px-4">
        SAT® is a trademark registered by the College Board, which is not affiliated with, and does not endorse, this product.
      </p>
      <div className="flex items-center gap-2 text-[9px] leading-tight text-muted-foreground/45">
        <PreloadLink to="/privacy" className={linkClassName}>Privacy</PreloadLink>
        <span aria-hidden="true">·</span>
        <PreloadLink to="/terms" className={linkClassName}>Terms</PreloadLink>
        <span aria-hidden="true">·</span>
        <PreloadLink to="/sat-resources" className={linkClassName}>Resources</PreloadLink>
        <span aria-hidden="true">·</span>
        <a href="mailto:info@1600.now" className={linkClassName}>Contact</a>
      </div>
    </div>
  );
};
