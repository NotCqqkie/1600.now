import { Link } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";
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
            fontFamily: "'Space Mono', monospace",
            fontSize: "clamp(80px, 16vw, 128px)",
            fontWeight: 700,
            lineHeight: 1,
            color: "hsl(var(--primary))",
            letterSpacing: "-0.04em",
            marginBottom: 16,
          }}
        >
          404
        </div>

        <h1
          style={{
            fontFamily: "'Geist', Georgia, serif",
            fontSize: "clamp(22px, 3vw, 28px)",
            fontWeight: 400,
            letterSpacing: "-0.02em",
            color: "hsl(var(--foreground))",
            marginBottom: 10,
          }}
        >
          Page not found
        </h1>
        <p className="text-sm text-muted-foreground mb-8" style={{ lineHeight: 1.65 }}>
          This page doesn't exist — maybe the URL changed or you followed an old link.
        </p>

        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-foreground underline-offset-4 hover:underline cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
