import { useState, useEffect, useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Calculator, BookOpen, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  mathDomainSkills,
  englishDomainSkills,
  allMathDomains,
  allEnglishDomains,
  type MathDomain,
  type EnglishDomain,
  type MathSkill,
  type EnglishSkill,
} from "@/data/questionCategories";

export interface TopicSelection {
  math: {
    selected: boolean;
    domains: Record<MathDomain, {
      selected: boolean;
      skills: Record<MathSkill, boolean>;
    }>;
  };
  reading: {
    selected: boolean;
    domains: Record<EnglishDomain, {
      selected: boolean;
      skills: Record<EnglishSkill, boolean>;
    }>;
  };
}

// Create initial empty selection
const createEmptySelection = (): TopicSelection => {
  const mathDomains: Record<string, { selected: boolean; skills: Record<string, boolean> }> = {};
  for (const domain of allMathDomains) {
    const skills: Record<string, boolean> = {};
    for (const skill of mathDomainSkills[domain]) {
      skills[skill] = false;
    }
    mathDomains[domain] = { selected: false, skills };
  }

  const readingDomains: Record<string, { selected: boolean; skills: Record<string, boolean> }> = {};
  for (const domain of allEnglishDomains) {
    const skills: Record<string, boolean> = {};
    for (const skill of englishDomainSkills[domain]) {
      skills[skill] = false;
    }
    readingDomains[domain] = { selected: false, skills };
  }

  return {
    math: {
      selected: false,
      domains: mathDomains as TopicSelection['math']['domains'],
    },
    reading: {
      selected: false,
      domains: readingDomains as TopicSelection['reading']['domains'],
    },
  };
};

interface TopicSelectorProps {
  selection: TopicSelection;
  onSelectionChange: (selection: TopicSelection) => void;
  questionCounts?: {
    math: {
      total: number;
      correct: number;
      domains: Record<string, { total: number; correct: number }>;
      skills: Record<string, { total: number; correct: number }>;
    };
    reading: {
      total: number;
      correct: number;
      domains: Record<string, { total: number; correct: number }>;
      skills: Record<string, { total: number; correct: number }>;
    };
  };
  onTopicClick?: (subject: "math" | "reading", domain?: string, skill?: string) => void;
}

export function TopicSelector({
  selection,
  onSelectionChange,
  questionCounts,
  onTopicClick,
}: TopicSelectorProps) {
  const [expandedMath, setExpandedMath] = useState<Record<string, boolean>>({});
  const [expandedReading, setExpandedReading] = useState<Record<string, boolean>>({});

  // Toggle subject (selects/deselects all under it)
  const toggleSubject = (subject: "math" | "reading", checked: boolean) => {
    const newSelection = { ...selection };
    
    if (subject === "math") {
      newSelection.math = {
        selected: checked,
        domains: { ...selection.math.domains },
      };
      for (const domain of allMathDomains) {
        newSelection.math.domains[domain] = {
          selected: checked,
          skills: Object.fromEntries(
            mathDomainSkills[domain].map(skill => [skill, checked])
          ) as Record<MathSkill, boolean>,
        };
      }
    } else {
      newSelection.reading = {
        selected: checked,
        domains: { ...selection.reading.domains },
      };
      for (const domain of allEnglishDomains) {
        newSelection.reading.domains[domain] = {
          selected: checked,
          skills: Object.fromEntries(
            englishDomainSkills[domain].map(skill => [skill, checked])
          ) as Record<EnglishSkill, boolean>,
        };
      }
    }
    
    onSelectionChange(newSelection);
  };

  // Toggle domain (selects/deselects all skills under it)
  const toggleDomain = (subject: "math" | "reading", domain: string, checked: boolean) => {
    const newSelection = { ...selection };
    
    if (subject === "math") {
      const mathDomain = domain as MathDomain;
      newSelection.math = {
        ...selection.math,
        domains: {
          ...selection.math.domains,
          [mathDomain]: {
            selected: checked,
            skills: Object.fromEntries(
              mathDomainSkills[mathDomain].map(skill => [skill, checked])
            ) as Record<MathSkill, boolean>,
          },
        },
      };
      // Update subject selection based on domains
      const allDomainsSelected = allMathDomains.every(
        d => d === mathDomain ? checked : newSelection.math.domains[d].selected
      );
      newSelection.math.selected = allDomainsSelected;
    } else {
      const englishDomain = domain as EnglishDomain;
      newSelection.reading = {
        ...selection.reading,
        domains: {
          ...selection.reading.domains,
          [englishDomain]: {
            selected: checked,
            skills: Object.fromEntries(
              englishDomainSkills[englishDomain].map(skill => [skill, checked])
            ) as Record<EnglishSkill, boolean>,
          },
        },
      };
      // Update subject selection based on domains
      const allDomainsSelected = allEnglishDomains.every(
        d => d === englishDomain ? checked : newSelection.reading.domains[d].selected
      );
      newSelection.reading.selected = allDomainsSelected;
    }
    
    onSelectionChange(newSelection);
  };

  // Toggle individual skill
  const toggleSkill = (subject: "math" | "reading", domain: string, skill: string, checked: boolean) => {
    const newSelection = { ...selection };
    
    if (subject === "math") {
      const mathDomain = domain as MathDomain;
      const mathSkill = skill as MathSkill;
      const newSkills = {
        ...selection.math.domains[mathDomain].skills,
        [mathSkill]: checked,
      };
      const allSkillsSelected = mathDomainSkills[mathDomain].every(s => 
        s === mathSkill ? checked : newSkills[s]
      );
      
      newSelection.math = {
        ...selection.math,
        domains: {
          ...selection.math.domains,
          [mathDomain]: {
            selected: allSkillsSelected,
            skills: newSkills,
          },
        },
      };
      
      // Update subject selection
      const allDomainsSelected = allMathDomains.every(
        d => d === mathDomain ? allSkillsSelected : newSelection.math.domains[d].selected
      );
      newSelection.math.selected = allDomainsSelected;
    } else {
      const englishDomain = domain as EnglishDomain;
      const englishSkill = skill as EnglishSkill;
      const newSkills = {
        ...selection.reading.domains[englishDomain].skills,
        [englishSkill]: checked,
      };
      const allSkillsSelected = englishDomainSkills[englishDomain].every(s => 
        s === englishSkill ? checked : newSkills[s]
      );
      
      newSelection.reading = {
        ...selection.reading,
        domains: {
          ...selection.reading.domains,
          [englishDomain]: {
            selected: allSkillsSelected,
            skills: newSkills,
          },
        },
      };
      
      // Update subject selection
      const allDomainsSelected = allEnglishDomains.every(
        d => d === englishDomain ? allSkillsSelected : newSelection.reading.domains[d].selected
      );
      newSelection.reading.selected = allDomainsSelected;
    }
    
    onSelectionChange(newSelection);
  };

  const getIndeterminate = (subject: "math" | "reading", domain?: string): boolean => {
    if (subject === "math") {
      if (domain) {
        const mathDomain = domain as MathDomain;
        const skills = selection.math.domains[mathDomain].skills;
        const values = Object.values(skills);
        const someSelected = values.some(v => v);
        const allSelected = values.every(v => v);
        return someSelected && !allSelected;
      } else {
        const someSelected = allMathDomains.some(d => 
          Object.values(selection.math.domains[d].skills).some(v => v)
        );
        const allSelected = selection.math.selected;
        return someSelected && !allSelected;
      }
    } else {
      if (domain) {
        const englishDomain = domain as EnglishDomain;
        const skills = selection.reading.domains[englishDomain].skills;
        const values = Object.values(skills);
        const someSelected = values.some(v => v);
        const allSelected = values.every(v => v);
        return someSelected && !allSelected;
      } else {
        const someSelected = allEnglishDomains.some(d => 
          Object.values(selection.reading.domains[d].skills).some(v => v)
        );
        const allSelected = selection.reading.selected;
        return someSelected && !allSelected;
      }
    }
  };

  const renderCounts = (total: number, correct: number) => {
    if (!questionCounts) return null;
    return (
      <span className="text-xs text-muted-foreground ml-auto">
        <span className="text-green-600 font-medium">{correct}</span>
        <span className="mx-0.5">/</span>
        <span>{total}</span>
      </span>
    );
  };

  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="space-y-4">
        {/* Math Section */}
        <div className="border rounded-lg p-3">
          <div className="flex items-center gap-3 mb-2">
            <Checkbox
              checked={selection.math.selected}
              onCheckedChange={(checked) => toggleSubject("math", !!checked)}
              data-indeterminate={getIndeterminate("math")}
              className="data-[indeterminate=true]:bg-primary/50"
            />
            <div 
              className="flex items-center gap-2 flex-1 cursor-pointer hover:text-primary"
              onClick={() => onTopicClick?.("math")}
            >
              <Calculator className="h-4 w-4 text-primary" />
              <span className="font-semibold">Math</span>
            </div>
            {questionCounts && renderCounts(
              questionCounts.math.total,
              questionCounts.math.correct
            )}
          </div>
          
          <div className="space-y-1 ml-6">
            {allMathDomains.map((domain) => (
              <div key={domain}>
                <div className="flex items-center gap-2 py-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => setExpandedMath(prev => ({ ...prev, [domain]: !prev[domain] }))}
                  >
                    {expandedMath[domain] ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                  <Checkbox
                    checked={selection.math.domains[domain].selected}
                    onCheckedChange={(checked) => toggleDomain("math", domain, !!checked)}
                    data-indeterminate={getIndeterminate("math", domain)}
                    className="data-[indeterminate=true]:bg-primary/50"
                  />
                  <span 
                    className="text-sm cursor-pointer hover:text-primary flex-1"
                    onClick={() => onTopicClick?.("math", domain)}
                  >
                    {domain}
                  </span>
                  {questionCounts && renderCounts(
                    questionCounts.math.domains[domain]?.total || 0,
                    questionCounts.math.domains[domain]?.correct || 0
                  )}
                </div>
                
                {expandedMath[domain] && (
                  <div className="ml-10 space-y-1">
                    {mathDomainSkills[domain].map((skill) => (
                      <div key={skill} className="flex items-center gap-2 py-0.5">
                        <Checkbox
                          checked={selection.math.domains[domain].skills[skill]}
                          onCheckedChange={(checked) => toggleSkill("math", domain, skill, !!checked)}
                        />
                        <span 
                          className="text-xs text-muted-foreground cursor-pointer hover:text-primary flex-1"
                          onClick={() => onTopicClick?.("math", domain, skill)}
                        >
                          {skill}
                        </span>
                        {questionCounts && renderCounts(
                          questionCounts.math.skills[skill]?.total || 0,
                          questionCounts.math.skills[skill]?.correct || 0
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Reading/Writing Section */}
        <div className="border rounded-lg p-3">
          <div className="flex items-center gap-3 mb-2">
            <Checkbox
              checked={selection.reading.selected}
              onCheckedChange={(checked) => toggleSubject("reading", !!checked)}
              data-indeterminate={getIndeterminate("reading")}
              className="data-[indeterminate=true]:bg-primary/50"
            />
            <div 
              className="flex items-center gap-2 flex-1 cursor-pointer hover:text-primary"
              onClick={() => onTopicClick?.("reading")}
            >
              <BookOpen className="h-4 w-4 text-secondary" />
              <span className="font-semibold">Reading & Writing</span>
            </div>
            {questionCounts && renderCounts(
              questionCounts.reading.total,
              questionCounts.reading.correct
            )}
          </div>
          
          <div className="space-y-1 ml-6">
            {allEnglishDomains.map((domain) => (
              <div key={domain}>
                <div className="flex items-center gap-2 py-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => setExpandedReading(prev => ({ ...prev, [domain]: !prev[domain] }))}
                  >
                    {expandedReading[domain] ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                  <Checkbox
                    checked={selection.reading.domains[domain].selected}
                    onCheckedChange={(checked) => toggleDomain("reading", domain, !!checked)}
                    data-indeterminate={getIndeterminate("reading", domain)}
                    className="data-[indeterminate=true]:bg-primary/50"
                  />
                  <span 
                    className="text-sm cursor-pointer hover:text-primary flex-1"
                    onClick={() => onTopicClick?.("reading", domain)}
                  >
                    {domain}
                  </span>
                  {questionCounts && renderCounts(
                    questionCounts.reading.domains[domain]?.total || 0,
                    questionCounts.reading.domains[domain]?.correct || 0
                  )}
                </div>
                
                {expandedReading[domain] && (
                  <div className="ml-10 space-y-1">
                    {englishDomainSkills[domain].map((skill) => (
                      <div key={skill} className="flex items-center gap-2 py-0.5">
                        <Checkbox
                          checked={selection.reading.domains[domain].skills[skill]}
                          onCheckedChange={(checked) => toggleSkill("reading", domain, skill, !!checked)}
                        />
                        <span 
                          className="text-xs text-muted-foreground cursor-pointer hover:text-primary flex-1"
                          onClick={() => onTopicClick?.("reading", domain, skill)}
                        >
                          {skill}
                        </span>
                        {questionCounts && renderCounts(
                          questionCounts.reading.skills[skill]?.total || 0,
                          questionCounts.reading.skills[skill]?.correct || 0
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

export { createEmptySelection };
