import { useMemo, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getBankPool } from "@/data/questionBank";
import { parseTestName } from "@/data/modules";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const ModuleView = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  
  const mathPool = useMemo(() => getBankPool("math"), []);
  const readingPool = useMemo(() => getBankPool("reading"), []);
  
  const allQuestions = useMemo(() => {
     return [...mathPool, ...readingPool];
  }, [mathPool, readingPool]);

  const moduleData = useMemo(() => {
    const questions = allQuestions.filter(q => {
        const p = parseTestName(q.testName || "");
        return p && p.id === moduleId;
    });
    
    if (questions.length === 0) return null;
    
    const firstParsed = parseTestName(questions[0].testName || "");
    return {
        metadata: firstParsed,
        questions: questions.sort((a, b) => a.questionNumber - b.questionNumber)
    };
  }, [allQuestions, moduleId]);

  // Auto-redirect to practice
  useEffect(() => {
    if (moduleData) {
        const { questions, metadata } = moduleData;
        const isMath = metadata?.subject === "Math";
        const pool = isMath ? mathPool : readingPool;

        const practiceSet = questions.map((q, idx) => {
            // Find global index in the pool
            // We use sourceId because that is the unique identifier from the raw data
            const globalIndex = pool.findIndex(pq => pq.sourceId === q.sourceId);
            
            if (globalIndex === -1) {
                console.warn("Question not found in pool", q.sourceId);
                return null;
            }

            return {
                subject: isMath ? "math" : "reading",
                id: globalIndex + 1, // 1-based index for the URL /bank/math/123
                sourceId: q.sourceId,
                index: idx
            };
        }).filter(Boolean); // Remove nulls

        if (practiceSet.length > 0) {
            sessionStorage.setItem('practiceSet', JSON.stringify(practiceSet));
            // Navigate to first question immediately
            const first = practiceSet[0];
            if (first) {
                 navigate(`/bank/${first.subject}/${first.id}?practice=true&idx=0`, { replace: true });
            }
        }
    }
  }, [moduleData, mathPool, readingPool, navigate]);

  if (!moduleData) {
      return (
        <div className="container mx-auto py-12 text-center">
             {/* If we haven't found data, it might be loading or actually missing. 
                 Since we don't have async loading here (it's memory based), 
                 if it's missing, it's really missing. */}
            <h2 className="text-xl font-semibold">Module not found</h2>
            <Button variant="link" asChild className="mt-4">
                <Link to="/modules">Return to Modules</Link>
            </Button>
        </div>
      );
  }

  return (
    <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Starting module...</p>
        </div>
    </div>
  );
};

export default ModuleView;
