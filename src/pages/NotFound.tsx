import { Link } from "react-router-dom";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { ArrowLeft } from "lucide-react";

const NotFound = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <div className="mb-8">
        <BrandLogo variant="mark" className="h-10 w-10" />
      </div>

      <div className="text-center max-w-sm">
        <div
          style={{
            fontFamily: "'Inter Tight', sans-serif",
            fontSize: "clamp(80px, 16vw, 128px)",
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
            color: "rgb(var(--ds-accent-deep))",
            letterSpacing: "-0.045em",
            marginBottom: 16,
          }}
        >
          404
        </div>

        <h1 className="font-display text-[22px] font-semibold leading-[1.15] tracking-[-0.015em] text-ink mb-3">
          Page not found
        </h1>
        <p className="font-sans text-[13px] leading-[1.55] text-ink-mid mb-8">
          This page doesn't exist — maybe the URL changed or you followed an old link.
        </p>

        <Link
          to="/"
          className="inline-flex items-center gap-2 font-sans text-[14px] font-semibold text-accent-deep hover:opacity-80 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
