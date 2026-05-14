import { useLocation } from "react-router-dom";

import NotFound from "@/pages/NotFound";
import LandingVariant from "@/pages/LandingVariant";
import PillarPage from "@/pages/sat-info/PillarPage";
import ScoreGoalPage from "@/pages/sat-info/ScoreGoalPage";
import { landingVariantBySlug } from "@/lib/seo-data/landingVariants";
import { pillarBySlug } from "@/lib/seo-data/pillarData";
import { scoreGoalBySlug } from "@/lib/seo-data/scoreGoalData";

const TopLevelSeoPage = () => {
  const location = useLocation();
  const slug = location.pathname.replace(/^\//, "").replace(/\/$/, "");

  if (landingVariantBySlug.has(slug)) return <LandingVariant />;
  if (pillarBySlug.has(slug)) return <PillarPage />;
  if (scoreGoalBySlug.has(slug)) return <ScoreGoalPage />;

  return <NotFound />;
};

export default TopLevelSeoPage;
