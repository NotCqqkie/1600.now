import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, BookOpen, Calculator, GraduationCap, Target, Trophy, Loader2, Layers } from "lucide-react";

// Category structure - hardcoded for instant load
const categoryTree = {
  Math: {
    icon: Calculator,
    domains: {
      "Algebra": {
        skills: [
          "Linear equations in one variable",
          "Linear functions",
          "Linear equations in two variables",
          "Systems of two linear equations in two variables",
          "Linear inequalities in one or two variables"
        ]
      },
      "Advanced Math": {
        skills: [
          "Equivalent expressions",
          "Nonlinear equations in one variable and systems of equations in two variables",
          "Nonlinear functions"
        ]
      },
      "Problem-Solving and Data Analysis": {
        skills: [
          "Ratios, rates, proportional relationships, and units",
          "Percentages",
          "One-variable data: Distributions and measures of center and spread",
          "Two-variable data: Models and scatterplots",
          "Probability and conditional probability",
          "Inference from sample statistics and margin of error",
          "Evaluating statistical claims: Observational studies and experiments"
        ]
      },
      "Geometry and Trigonometry": {
        skills: [
          "Area and volume",
          "Lines, angles, and triangles",
          "Right triangles and trigonometry",
          "Circles"
        ]
      }
    }
  },
  Reading: {
    icon: BookOpen,
    domains: {
      "Craft and Structure": {
        skills: [
          "Words in Context",
          "Text Structure and Purpose",
          "Cross-Text Connections"
        ]
      },
      "Information and Ideas": {
        skills: [
          "Central Ideas and Details",
          "Command of Evidence",
          "Inferences"
        ]
      },
      "Standard English Conventions": {
        skills: [
          "Boundaries",
          "Form, Structure, and Sense"
        ]
      },
      "Expression of Ideas": {
        skills: [
          "Rhetorical Synthesis",
          "Transitions"
        ]
      }
    }
  }
};

// Approximate question counts per skill (estimates shown while loading real data)
const defaultSkillCounts: Record<string, number> = {
  "Linear equations in one variable": 180,
  "Linear functions": 165,
  "Linear equations in two variables": 145,
  "Systems of two linear equations in two variables": 130,
  "Linear inequalities in one or two variables": 124,
  "Equivalent expressions": 210,
  "Nonlinear equations in one variable and systems of equations in two variables": 195,
  "Nonlinear functions": 205,
  "Ratios, rates, proportional relationships, and units": 95,
  "Percentages": 85,
  "One-variable data: Distributions and measures of center and spread": 78,
  "Two-variable data: Models and scatterplots": 82,
  "Probability and conditional probability": 65,
  "Inference from sample statistics and margin of error": 42,
  "Evaluating statistical claims: Observational studies and experiments": 35,
  "Area and volume": 95,
  "Lines, angles, and triangles": 105,
  "Right triangles and trigonometry": 85,
  "Circles": 60,
  "Words in Context": 245,
  "Text Structure and Purpose": 180,
  "Cross-Text Connections": 145,
  "Central Ideas and Details": 215,
  "Command of Evidence": 198,
  "Inferences": 196,
  "Boundaries": 265,
  "Form, Structure, and Sense": 233,
  "Rhetorical Synthesis": 228,
  "Transitions": 225
};

const Index = () => {
  const navigate = useNavigate();
  const [skillCounts, setSkillCounts] = useState<Record<string, number>>(defaultSkillCounts);
  const [isLoading, setIsLoading] = useState(true);

  // Load real counts after initial render
  useEffect(() => {
    const loadCounts = async () => {
      try {
        // Dynamic import to avoid blocking initial load
        const { getSkillCounts } = await import("@/data/questionBank");
        
        // Use setTimeout to allow UI to render first
        setTimeout(() => {
          const mathCounts = getSkillCounts("math");
          const readingCounts = getSkillCounts("reading");
          setSkillCounts({ ...mathCounts, ...readingCounts });
          setIsLoading(false);
        }, 100);
      } catch (error) {
        console.error("Failed to load skill counts:", error);
        setIsLoading(false);
      }
    };
    loadCounts();
  }, []);

  const handleSkillClick = (subject: string, skill: string) => {
    navigate(`/bank/${subject.toLowerCase()}/skill/${encodeURIComponent(skill)}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <img
                src="/logo_b.png"
                alt="1600.now"
                className="h-8 w-auto max-w-[220px] object-contain dark:hidden"
              />
              <img
                src="/logo_w.png"
                alt="1600.now"
                className="hidden h-8 w-auto max-w-[220px] object-contain dark:block"
              />
              <p className="text-muted-foreground text-sm">Master the SAT with comprehensive practice</p>
            </div>
          </div>
        </div>
      </header>

      {/* Quick Access Cards */}
      <section className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card 
            className="p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 border-primary/20 hover:border-primary/50"
            onClick={() => navigate("/hard/1")}
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Trophy className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-bold">100 Hard Questions</h3>
                <p className="text-sm text-muted-foreground">Curated challenging problems</p>
              </div>
            </div>
          </Card>

          <Card 
            className="p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 border-green-500/20 hover:border-green-500/50"
            onClick={() => navigate("/vocab")}
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <GraduationCap className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Vocabulary</h3>
                <p className="text-sm text-muted-foreground">High & mid frequency words</p>
              </div>
            </div>
          </Card>

          <Card 
            className="p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 border-purple-500/20 hover:border-purple-500/50"
            onClick={() => navigate("/bank")}
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-500/10">
                <Target className="h-8 w-8 text-purple-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Full Question Bank</h3>
                <p className="text-sm text-muted-foreground">5,880+ practice questions</p>
              </div>
            </div>
          </Card>

          <Card 
            className="p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 border-orange-500/20 hover:border-orange-500/50"
            onClick={() => navigate("/modules")}
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-orange-500/10">
                <Layers className="h-8 w-8 text-orange-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Practice Modules</h3>
                <p className="text-sm text-muted-foreground">Full exams by year & level</p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Main Content - Two Column Tree */}
      <main className="container mx-auto px-4 py-4">
        <h2 className="text-2xl font-bold mb-6">Browse by Topic</h2>
        <div className="grid md:grid-cols-2 gap-8">
          {Object.entries(categoryTree).map(([subject, data]) => {
            const Icon = data.icon;
            const totalQuestions = Object.values(data.domains).reduce((sum, domain) => 
              sum + domain.skills.reduce((s, skill) => s + (skillCounts[skill] || 0), 0), 0
            );
            
            return (
              <Card key={subject} className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className={`p-3 rounded-lg ${subject === "Math" ? "bg-blue-100 dark:bg-blue-900" : "bg-green-100 dark:bg-green-900"}`}>
                    <Icon className={`h-6 w-6 ${subject === "Math" ? "text-blue-600 dark:text-blue-400" : "text-green-600 dark:text-green-400"}`} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{subject}</h2>
                    <p className="text-sm text-muted-foreground">{totalQuestions} questions</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {Object.entries(data.domains).map(([domain, domainData]) => {
                    const domainTotal = domainData.skills.reduce((s, skill) => s + (skillCounts[skill] || 0), 0);
                    
                    return (
                      <div key={domain} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-lg">{domain}</h3>
                          <Badge variant="secondary">{domainTotal}</Badge>
                        </div>
                        
                        <div className="space-y-1">
                          {domainData.skills.map((skill) => (
                            <Button
                              key={skill}
                              variant="ghost"
                              className="w-full justify-between h-auto py-2 px-3 text-left hover:bg-muted"
                              onClick={() => handleSkillClick(subject, skill)}
                            >
                              <span className="text-sm truncate flex-1 mr-2">{skill}</span>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <Badge variant="outline" className="text-xs min-w-[40px] justify-center">
                                  {isLoading ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    skillCounts[skill] || 0
                                  )}
                                </Badge>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </Button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-12">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>© 2024 1600.now - SAT Practice Platform</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
