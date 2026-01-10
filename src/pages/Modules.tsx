import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getBankPool, type BankQuestion } from "@/data/questionBank";
import { parseTestName, type ModuleMetadata } from "@/data/modules";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Calculator, Calendar, Filter, GraduationCap } from "lucide-react";

const Modules = () => {
  const navigate = useNavigate();
  
  // Combine all questions
  const allQuestions = useMemo(() => {
    return [...getBankPool("math"), ...getBankPool("reading")];
  }, []);

  // Group by Module
  const modules = useMemo(() => {
    const map = new Map<string, ModuleMetadata & { questionType: string }>();
    
    allQuestions.forEach(q => {
      const parsed = parseTestName(q.testName || "");
      if (parsed && parsed.id) {
        if (!map.has(parsed.id)) {
          map.set(parsed.id, { ...parsed, questionCount: 0, questionType: parsed.subject || "Math" } as any);
        }
        const meta = map.get(parsed.id)!;
        meta.questionCount++;
      }
    });
    
    return Array.from(map.values()).sort((a, b) => {
      // Sort by Year desc, then Month desc
      if (a.year !== b.year) return b.year - a.year;
      // Simple string sort for month might not be chronologically correct but okay for now
      return (a.testName || "").localeCompare(b.testName || "");
    });
  }, [allQuestions]);

  // Filters
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [moduleFilter, setModuleFilter] = useState<string>("all");

  const availableYears = useMemo(() => Array.from(new Set(modules.map(m => m.year))).sort((a, b) => b - a), [modules]);

  const filteredModules = useMemo(() => {
    return modules.filter(m => {
      if (subjectFilter !== "all" && m.subject !== (subjectFilter === "math" ? "Math" : "Reading & Writing")) return false;
      if (yearFilter !== "all" && m.year.toString() !== yearFilter) return false;
      if (moduleFilter !== "all") {
        if (moduleFilter === "1" && m.moduleNumber !== 1) return false;
        if (moduleFilter === "2" && m.moduleNumber !== 2) return false;
        if (moduleFilter === "easy" && (m.moduleNumber !== 2 || m.difficulty !== "Easy")) return false; // Heuristic?
        // Note: difficulty parsing for "easy/hard" might need checking logic in parseTestName
      }
      return true;
    });
  }, [modules, subjectFilter, yearFilter, moduleFilter]);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BookOpen className="h-8 w-8" />
            Practice Modules
          </h1>
          <p className="text-muted-foreground mt-2">
            Browse and practice full exam modules sorted by year and subject.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 p-4 bg-muted/30 rounded-lg border">
        <div className="flex items-center gap-2 font-medium text-muted-foreground">
          <Filter className="h-4 w-4" /> Filters:
        </div>
        
        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            <SelectItem value="math">Math</SelectItem>
            <SelectItem value="reading">Reading & Writing</SelectItem>
          </SelectContent>
        </Select>

        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {availableYears.map(y => (
              <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Module Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modules</SelectItem>
            <SelectItem value="1">Module 1</SelectItem>
            <SelectItem value="2">Module 2 (All)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredModules.map((m) => (
          <Card key={m.id} className="hover:shadow-md transition-shadow cursor-pointer border-t-4 border-t-primary/50" onClick={() => navigate(`/modules/${m.id}`)}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <Badge variant={m.subject === "Math" ? "default" : "secondary"}>
                  {m.subject === "Math" ? <Calculator className="w-3 h-3 mr-1" /> : <BookOpen className="w-3 h-3 mr-1" />}
                  {m.subject}
                </Badge>
                <Badge variant="outline" className="font-mono">
                  {m.year}
                </Badge>
              </div>
              <CardTitle className="text-lg mt-2 leading-tight">
                {m.month} {m.year} {m.form ? `Form ${m.form}` : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <GraduationCap className="h-4 w-4" />
                  Module {m.moduleNumber}
                </span>
                <span>
                  {m.questionCount} Questions
                </span>
              </div>
            </CardContent>
            <CardFooter className="pt-0">
               <Button className="w-full" variant="outline">Start Practice</Button>
            </CardFooter>
          </Card>
        ))}
      </div>
      
      {filteredModules.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No modules found matching your filters.
        </div>
      )}
    </div>
  );
};

export default Modules;
