import { useState, useEffect } from "react";
import questionsData from "@/data/questions.json";
import { classifyQuestion, type QuestionCategory } from "@/data/questionCategories";
import { Question } from "@/data/types";

const questions = questionsData as unknown as Question[];

import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Download } from "lucide-react";

const Analysis = () => {
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Run analysis in a timeout to unblock the main thread for initial render
    const timer = setTimeout(() => {
      const counts: Record<string, Record<string, number>> = {
        "Math": {},
        "English": {}
      };
      const skillCounts: Record<string, number> = {};
      const lowConfidence: any[] = [];
      const categoryGroups: Record<string, any[]> = {};

      questions.forEach((q) => {
        const isMath = q.test_name.toLowerCase().includes("math");
        const fullText = [q.passage, q.question_text, ...(q.choices?.map(c => c.text) || [])].filter(Boolean).join(" ");
        
        const category = classifyQuestion(fullText, isMath);
        
        if (category) {
          // Init domain count
          if (!counts[category.subject][category.domain]) {
            counts[category.subject][category.domain] = 0;
          }
          counts[category.subject][category.domain]++;
          
          // Init skill count
          if (!skillCounts[category.skill]) {
            skillCounts[category.skill] = 0;
          }
          skillCounts[category.skill]++;
          
          const key = `${category.domain} - ${category.skill}`;
          if (!categoryGroups[key]) categoryGroups[key] = [];
          
          if (category.confidence === "low") {
            lowConfidence.push({
              id: q.id,
              text: q.question_text?.substring(0, 100) + "...",
              assigned: key,
              fullCategory: category
            });
          }
          
          // Keep a sample of 5 for each category
          if (categoryGroups[key].length < 5) {
            categoryGroups[key].push({
               id: q.id,
               text: q.question_text?.substring(0, 100) + "...",
               confidence: category.confidence
            });
          }
        }
      });

      setAnalysis({ counts, skillCounts, lowConfidence, categoryGroups });
      setLoading(false);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const handleDownloadReport = () => {
    const fullMap: Record<string, any> = {};
    const lowConfidenceReport: any[] = [];

    questions.forEach((q) => {
      const isMath = q.test_name.toLowerCase().includes("math");
      const fullText = [q.passage, q.question_text, ...(q.choices?.map(c => c.text) || [])].filter(Boolean).join(" ");
      const category = classifyQuestion(fullText, isMath);
      
      if (category) {
        fullMap[q.id] = {
            ...category,
            question_text_preview: q.question_text?.substring(0, 50)
        };
        
        if (category.confidence === "low") {
            lowConfidenceReport.push({
                id: q.id,
                text: q.question_text,
                assigned: category,
                full_text: fullText
            });
        }
      }
    });

    const report = {
        timestamp: new Date().toISOString(),
        summary: analysis.counts,
        low_confidence_items: lowConfidenceReport,
        full_categorization: fullMap
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sat_audit_report.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const userCounts = {
    "Math": {
      "Algebra": 744,
      "Advanced Math": 610,
      "Problem-Solving and Data Analysis": 462,
      "Geometry and Trigonometry": 345,
    },
    "English": {
      "Craft and Structure": 570,
      "Information and Ideas": 609,
      "Standard English Conventions": 498,
      "Expression of Ideas": 453,
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Analyzing 5,880 questions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Classification Analysis</h1>
        <Button onClick={handleDownloadReport}>
            <Download className="mr-2 h-4 w-4" />
            Download Audit Report
        </Button>
      </div>
      
      <div className="grid md:grid-cols-2 gap-8">
        {["Math", "English"].map((subject) => (
          <Card key={subject} className="p-6">
            <h2 className="text-xl font-bold mb-4">{subject} Domains</h2>
            <div className="space-y-4">
              {Object.entries(analysis.counts[subject] || {}).map(([domain, count]) => {
                const target = (userCounts as any)[subject][domain];
                const diff = (count as number) - target;
                return (
                  <div key={domain} className="flex justify-between items-center border-b pb-2">
                    <div>
                      <p className="font-medium">{domain}</p>
                      <p className="text-xs text-muted-foreground">Target: {target}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{count as number}</p>
                      <p className={`text-xs ${diff > 0 ? "text-green-600" : "text-red-600"}`}>
                        {diff > 0 ? "+" : ""}{diff}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">Low Confidence ({analysis.lowConfidence.length})</h2>
        <ScrollArea className="h-[400px]">
          <div className="space-y-2">
            {analysis.lowConfidence.map((item, i) => (
              <div key={i} className="p-3 border rounded bg-muted/20 text-sm">
                <div className="flex justify-between mb-1">
                  <Badge variant="outline">{item.assigned}</Badge>
                  <span className="text-xs text-muted-foreground">{item.id}</span>
                </div>
                <p>{item.text}</p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>
      
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Category Samples</h2>
        {Object.entries(analysis.categoryGroups).sort().map(([key, samples]) => (
           <Card key={key} className="p-4">
             <h3 className="font-semibold mb-2">{key}</h3>
             <div className="space-y-2">
               {(samples as any[]).map((s: any) => (
                 <div key={s.id} className="text-xs border-l-2 pl-2">
                   <span className={`font-bold ${s.confidence === 'high' ? 'text-green-600' : s.confidence === 'medium' ? 'text-yellow-600' : 'text-red-600'}`}>
                     [{s.confidence}]
                   </span> {s.text}
                 </div>
               ))}
             </div>
           </Card>
        ))}
      </div>
    </div>
  );
};

export default Analysis;
