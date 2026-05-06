import { useLocation } from "react-router-dom";

import NotFound from "@/pages/NotFound";
import LandingVariant from "@/pages/LandingVariant";
import PillarPage from "@/pages/PillarPage";
import ScoreGoalPage from "@/pages/ScoreGoalPage";
import { landingVariantBySlug } from "@/lib/landingVariants";
import { pillarBySlug } from "@/lib/pillarData";
import { scoreGoalBySlug } from "@/lib/scoreGoalData";

const TopLevelSeoPage = () => {
  const location = useLocation();
  const slug = location.pathname.replace(/^\//, "").replace(/\/$/, "");

  if (landingVariantBySlug.has(slug)) return <LandingVariant />;
  if (pillarBySlug.has(slug)) return <PillarPage />;
  if (scoreGoalBySlug.has(slug)) return <ScoreGoalPage />;

  return <NotFound />;
};

export default TopLevelSeoPage;
