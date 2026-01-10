import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, Shuffle } from "lucide-react";
import { MultiSelect, Option } from "@/components/ui/multi-select";
import { useState } from "react";

// Define filter types
export interface FilterState {
  topics: string[];
  status: "all" | "active" | "archived";
  program: "all" | "math" | "english";
  difficulty: "all" | "easy" | "medium" | "hard";
  scoreBand: "all" | "200-400" | "400-600" | "600-800";
  timeSpent: "all" | "0-20s" | "20-40s" | "40s-1m" | "1m-2m" | "2m-3m" | "3m-5m" | "5m+";
  markedForReview: boolean;
  showSolved: boolean;
  showIncorrect: boolean;
  showPreviousAttempts: boolean;
}

interface FilterBarProps {
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  topicOptions: Option[];
  onShuffle: () => void;
}

export function FilterBar({ filters, setFilters, topicOptions, onShuffle }: FilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateFilter = (key: keyof FilterState, value: any) => {
    setFilters({ ...filters, [key]: value });
  };

  return (
    <div className="space-y-4 mb-6">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-2 items-center flex-1">
            <Button variant={isExpanded ? "secondary" : "outline"} onClick={() => setIsExpanded(!isExpanded)}>
            <Filter className="mr-2 h-4 w-4" />
            Filters
            </Button>
            
            <div className="w-[300px]">
                <MultiSelect 
                    options={topicOptions} 
                    selected={filters.topics} 
                    onChange={(val) => updateFilter('topics', val)}
                    placeholder="Select multiple topics"
                />
            </div>

            <Button variant="outline" onClick={onShuffle}>
            <Shuffle className="mr-2 h-4 w-4" />
            Shuffle questions
            </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-card">
            {/* Row 1 */}
            <div className="space-y-2">
                <Label>Active Questions</Label>
                <Select value={filters.status} onValueChange={(v) => updateFilter('status', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Questions</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Program</Label>
                <Select value={filters.program} onValueChange={(v) => updateFilter('program', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Programs</SelectItem>
                        <SelectItem value="math">SAT Math</SelectItem>
                        <SelectItem value="english">SAT English</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Difficulty</Label>
                <Select value={filters.difficulty} onValueChange={(v) => updateFilter('difficulty', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Any Difficulty</SelectItem>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Score Band</Label>
                <Select value={filters.scoreBand} onValueChange={(v) => updateFilter('scoreBand', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Any Score</SelectItem>
                        <SelectItem value="200-400">200-400</SelectItem>
                        <SelectItem value="400-600">400-600</SelectItem>
                        <SelectItem value="600-800">600-800</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Row 2 */}
            <div className="space-y-2">
                <Label>Time Spent Solving</Label>
                <Select value={filters.timeSpent} onValueChange={(v) => updateFilter('timeSpent', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Any Time</SelectItem>
                        <SelectItem value="0-20s">0-20s</SelectItem>
                        <SelectItem value="20-40s">20-40s</SelectItem>
                        <SelectItem value="40s-1m">40s - 1m</SelectItem>
                        <SelectItem value="1m-2m">1m - 2m</SelectItem>
                        <SelectItem value="2m-3m">2m - 3m</SelectItem>
                        <SelectItem value="3m-5m">3m - 5m</SelectItem>
                        <SelectItem value="5m+">5m+</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="flex items-center justify-between p-2 border rounded">
                <Label>Marked for Review</Label>
                <Switch 
                    checked={filters.markedForReview}
                    onCheckedChange={(val) => updateFilter('markedForReview', val)}
                />
            </div>

            <div className="flex items-center justify-between p-2 border rounded">
                <Label>Solved</Label>
                <Switch 
                    checked={filters.showSolved}
                    onCheckedChange={(val) => updateFilter('showSolved', val)}
                />
            </div>

            <div className="flex items-center justify-between p-2 border rounded">
                <Label>Answered Incorrectly</Label>
                <Switch 
                    checked={filters.showIncorrect}
                    onCheckedChange={(val) => updateFilter('showIncorrect', val)}
                />
            </div>
        </div>
      )}
    </div>
  );
}
