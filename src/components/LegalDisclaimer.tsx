import { Link } from "react-router-dom";

export const LegalDisclaimer = () => {
  return (
    <div className="flex flex-col items-center gap-1 px-4 pb-3 pt-1 sm:pb-4">
      <p className="pointer-events-none max-w-[42rem] rounded-full border border-border/30 bg-background/20 px-3 py-1 text-center text-[9px] leading-tight text-muted-foreground/45 shadow-sm backdrop-blur-[2px] select-none sm:px-4">
        SAT® is a trademark registered by the College Board, which is not affiliated with, and does not endorse, this product.
      </p>
      <div className="flex items-center gap-2 text-[9px] leading-tight text-muted-foreground/45">
        <Link to="/privacy" className="hover:text-muted-foreground/70 hover:underline">Privacy</Link>
        <span aria-hidden="true">·</span>
        <Link to="/terms" className="hover:text-muted-foreground/70 hover:underline">Terms</Link>
        <span aria-hidden="true">·</span>
        <a href="mailto:questions@1600.now" className="hover:text-muted-foreground/70 hover:underline">Contact</a>
      </div>
    </div>
  );
};
