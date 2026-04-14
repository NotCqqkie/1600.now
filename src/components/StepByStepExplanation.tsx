import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Loader2,
  RotateCcw,
  Lightbulb,
  AlertTriangle,
} from "lucide-react";
import { renderMixedContent } from "@/lib/mathRendering";
import {
  generateExplanation,
  getCachedExplanation,
  clearExplanationCache,
  type ExplanationData,
  type ExplanationStep,
} from "@/lib/explanationApi";
import "katex/dist/katex.min.css";

// ── Safe math expression evaluator (no eval/Function) ────────────────
function safeEvaluate(expr: string, x: number): number | null {
  try {
    const tokens = tokenize(expr, x);
    if (!tokens) return null;
    const result = parseExpr(tokens, 0);
    return result?.value ?? null;
  } catch {
    return null;
  }
}

type Token = { type: "num"; value: number } | { type: "op"; value: string };

function tokenize(expr: string, xVal: number): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  const s = expr.replace(/\s+/g, "");

  while (i < s.length) {
    if (s[i] === "x" || s[i] === "X") {
      if (tokens.length > 0 && tokens[tokens.length - 1].type === "num") {
        tokens.push({ type: "op", value: "*" });
      }
      tokens.push({ type: "num", value: xVal });
      i++;
    } else if ("0123456789.".includes(s[i])) {
      let num = "";
      while (i < s.length && "0123456789.".includes(s[i])) {
        num += s[i++];
      }
      tokens.push({ type: "num", value: parseFloat(num) });
    } else if ("+-*/^()".includes(s[i])) {
      tokens.push({ type: "op", value: s[i] });
      i++;
    } else {
      return null;
    }
  }
  return tokens;
}

function parseExpr(tokens: Token[], pos: number): { value: number; pos: number } | null {
  let left = parseTerm(tokens, pos);
  if (!left) return null;
  while (left.pos < tokens.length && tokens[left.pos].type === "op" && (tokens[left.pos].value === "+" || tokens[left.pos].value === "-")) {
    const op = tokens[left.pos].value;
    const right = parseTerm(tokens, left.pos + 1);
    if (!right) return null;
    left = { value: op === "+" ? left.value + right.value : left.value - right.value, pos: right.pos };
  }
  return left;
}

function parseTerm(tokens: Token[], pos: number): { value: number; pos: number } | null {
  let left = parsePower(tokens, pos);
  if (!left) return null;
  while (left.pos < tokens.length && tokens[left.pos].type === "op" && (tokens[left.pos].value === "*" || tokens[left.pos].value === "/")) {
    const op = tokens[left.pos].value;
    const right = parsePower(tokens, left.pos + 1);
    if (!right) return null;
    left = { value: op === "*" ? left.value * right.value : left.value / right.value, pos: right.pos };
  }
  return left;
}

function parsePower(tokens: Token[], pos: number): { value: number; pos: number } | null {
  let base = parseUnary(tokens, pos);
  if (!base) return null;
  if (base.pos < tokens.length && tokens[base.pos].type === "op" && tokens[base.pos].value === "^") {
    const exp = parsePower(tokens, base.pos + 1);
    if (!exp) return null;
    return { value: Math.pow(base.value, exp.value), pos: exp.pos };
  }
  return base;
}

function parseUnary(tokens: Token[], pos: number): { value: number; pos: number } | null {
  if (pos >= tokens.length) return null;
  if (tokens[pos].type === "op" && tokens[pos].value === "-") {
    const inner = parseUnary(tokens, pos + 1);
    if (!inner) return null;
    return { value: -inner.value, pos: inner.pos };
  }
  if (tokens[pos].type === "op" && tokens[pos].value === "(") {
    const inner = parseExpr(tokens, pos + 1);
    if (!inner) return null;
    if (inner.pos < tokens.length && tokens[inner.pos].type === "op" && tokens[inner.pos].value === ")") {
      return { value: inner.value, pos: inner.pos + 1 };
    }
    return null;
  }
  if (tokens[pos].type === "num") {
    return { value: tokens[pos].value as number, pos: pos + 1 };
  }
  return null;
}

function parseEquationToFn(eq: string): ((x: number) => number) | null {
  let expr = eq.replace(/^[yf]\s*(?:\(x\))?\s*=\s*/i, "").trim();
  const test = safeEvaluate(expr, 1);
  if (test === null || !isFinite(test)) return null;
  return (x: number) => safeEvaluate(expr, x) ?? NaN;
}

// ── Mini graph renderer ──────────────────────────────────────────────
function MiniGraph({ graph }: { graph: NonNullable<ExplanationStep["graph"]> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const W = 320;
  const H = 240;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const xRange = graph.xRange ?? [-10, 10];
    const yRange = graph.yRange ?? [-10, 10];
    const pad = 30;

    const toX = (x: number) => pad + ((x - xRange[0]) / (xRange[1] - xRange[0])) * (W - 2 * pad);
    const toY = (y: number) => H - pad - ((y - yRange[0]) / (yRange[1] - yRange[0])) * (H - 2 * pad);

    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = "#2a2a4a";
    ctx.lineWidth = 0.5;
    for (let x = Math.ceil(xRange[0]); x <= xRange[1]; x++) {
      ctx.beginPath(); ctx.moveTo(toX(x), pad); ctx.lineTo(toX(x), H - pad); ctx.stroke();
    }
    for (let y = Math.ceil(yRange[0]); y <= yRange[1]; y++) {
      ctx.beginPath(); ctx.moveTo(pad, toY(y)); ctx.lineTo(W - pad, toY(y)); ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 1;
    if (xRange[0] <= 0 && xRange[1] >= 0) {
      ctx.beginPath(); ctx.moveTo(toX(0), pad); ctx.lineTo(toX(0), H - pad); ctx.stroke();
    }
    if (yRange[0] <= 0 && yRange[1] >= 0) {
      ctx.beginPath(); ctx.moveTo(pad, toY(0)); ctx.lineTo(W - pad, toY(0)); ctx.stroke();
    }

    // Labels
    ctx.fillStyle = "#888";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    for (let x = Math.ceil(xRange[0]); x <= xRange[1]; x++) {
      if (x === 0) continue;
      ctx.fillText(String(x), toX(x), toY(0) + 14);
    }
    ctx.textAlign = "right";
    for (let y = Math.ceil(yRange[0]); y <= yRange[1]; y++) {
      if (y === 0) continue;
      ctx.fillText(String(y), toX(0) - 5, toY(y) + 3);
    }

    // Plot equations
    const colors = ["#4ade80", "#f97316", "#60a5fa", "#f472b6"];
    if (graph.equations) {
      graph.equations.forEach((eq, idx) => {
        ctx.strokeStyle = colors[idx % colors.length];
        ctx.lineWidth = 2;
        ctx.beginPath();
        let started = false;
        const fn = parseEquationToFn(eq);
        if (!fn) return;
        for (let px = pad; px <= W - pad; px++) {
          const x = xRange[0] + ((px - pad) / (W - 2 * pad)) * (xRange[1] - xRange[0]);
          const y = fn(x);
          if (isNaN(y) || !isFinite(y)) { started = false; continue; }
          const py = toY(y);
          if (!started) { ctx.moveTo(px, py); started = true; } else { ctx.lineTo(px, py); }
        }
        ctx.stroke();
      });
    }

    // Plot points
    if (graph.points) {
      graph.points.forEach((pt, idx) => {
        const px = toX(pt.x);
        const py = toY(pt.y);
        ctx.fillStyle = colors[idx % colors.length];
        ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(pt.label || `(${pt.x}, ${pt.y})`, px + 8, py - 4);
      });
    }
  }, [graph]);

  return (
    <div className="flex justify-center my-3">
      <canvas ref={canvasRef} style={{ width: W, height: H }} className="rounded-lg border border-border/50" />
    </div>
  );
}

// ── Highlights renderer ──────────────────────────────────────────────
function Highlights({ highlights }: { highlights: NonNullable<ExplanationStep["highlights"]> }) {
  const colorMap: Record<string, string> = {
    green: "bg-green-500/20 text-green-400 border-green-500/40",
    red: "bg-red-500/20 text-red-400 border-red-500/40",
    yellow: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
    blue: "bg-blue-500/20 text-blue-400 border-blue-500/40",
  };

  return (
    <div className="flex flex-wrap gap-2 my-2">
      {highlights.map((h, i) => (
        <span key={i} className={`px-2 py-1 rounded border text-sm ${colorMap[h.color] || colorMap.yellow}`}>
          &ldquo;{h.text}&rdquo;
        </span>
      ))}
    </div>
  );
}

// ── Elimination display ──────────────────────────────────────────────
function EliminationDisplay({ choices }: { choices: NonNullable<ExplanationStep["eliminationChoices"]> }) {
  return (
    <div className="space-y-2 my-3">
      {choices.map((c) => {
        // Content rendered via renderMixedContent — same pattern used
        // throughout the codebase for KaTeX math in answer choices
        const rendered = renderMixedContent(c.text);
        return (
          <div
            key={c.label}
            className={`flex items-start gap-2 p-2 rounded-lg border transition-all ${
              c.eliminated ? "border-red-500/30 bg-red-500/5 opacity-70" : "border-green-500/40 bg-green-500/10"
            }`}
          >
            <div className="mt-0.5">
              {c.eliminated ? <X className="w-4 h-4 text-red-400" /> : <Check className="w-4 h-4 text-green-400" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Badge variant={c.eliminated ? "destructive" : "default"} className="text-xs">{c.label}</Badge>
                <span
                  className={`text-sm ${c.eliminated ? "line-through text-muted-foreground" : "font-medium"}`}
                  dangerouslySetInnerHTML={{ __html: rendered }}
                />
              </div>
              {c.reason && <p className="text-xs text-muted-foreground mt-1 ml-6">{c.reason}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────
interface StepByStepExplanationProps {
  questionId: string;
  question: {
    section: string;
    passage: string;
    questionText?: string | null;
    choices?: { label: string; text: string }[];
    correctAnswer: string;
    domain?: string;
    skill?: string;
    difficulty?: string;
    isFillInBlank?: boolean;
  };
}

export function StepByStepExplanation({ questionId, question }: StepByStepExplanationProps) {
  const [data, setData] = useState<ExplanationData | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllSteps, setShowAllSteps] = useState(false);
  const stepRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cached = getCachedExplanation(questionId);
    if (cached) {
      setData(cached);
      setCurrentStep(0);
      setShowAllSteps(false);
      setError(null);
    } else {
      setData(null);
      setCurrentStep(0);
      setShowAllSteps(false);
    }
  }, [questionId]);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateExplanation(questionId, question);
      setData(result);
      setCurrentStep(0);
      setShowAllSteps(false);
    } catch (err: any) {
      setError(err.message || "Failed to generate explanation");
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    clearExplanationCache(questionId);
    setData(null);
    await handleGenerate();
  };

  const handleNext = () => {
    if (data && currentStep < data.steps.length - 1) {
      setCurrentStep((s) => s + 1);
      stepRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
      stepRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  if (!data && !loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-8">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Lightbulb className="w-8 h-8 text-primary" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold">Step-by-Step Walkthrough</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Get an AI-powered detailed breakdown of this question
          </p>
        </div>
        <Button onClick={handleGenerate} size="lg" className="gap-2">
          <Lightbulb className="w-4 h-4" />
          Generate Explanation
        </Button>
        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm mt-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Generating step-by-step explanation...</p>
      </div>
    );
  }

  if (!data) return null;

  const totalSteps = data.steps.length;
  const step = data.steps[currentStep];
  const isLast = currentStep === totalSteps - 1;
  const isFirst = currentStep === 0;

  return (
    <div className="flex flex-col h-full" ref={stepRef}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs">Correct: {data.correctAnswer}</Badge>
          <span className="text-xs text-muted-foreground">Step {currentStep + 1} of {totalSteps}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowAllSteps(!showAllSteps)} className="text-xs h-7">
            {showAllSteps ? "Step View" : "Show All"}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleRegenerate} className="h-7 w-7 p-0" title="Regenerate">
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <Progress value={((currentStep + 1) / totalSteps) * 100} className="h-1 rounded-none" />

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {showAllSteps ? (
          <div className="space-y-6">
            {data.steps.map((s, i) => (
              <StepContent key={i} step={s} stepIndex={i} />
            ))}
          </div>
        ) : (
          <StepContent step={step} stepIndex={currentStep} />
        )}
      </div>

      {/* Navigation */}
      {!showAllSteps && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
          <Button variant="outline" size="sm" onClick={handlePrev} disabled={isFirst} className="gap-1">
            <ChevronLeft className="w-4 h-4" /> Previous
          </Button>
          <div className="flex items-center gap-1.5">
            {data.steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentStep ? "bg-primary w-4" : i < currentStep ? "bg-primary/50" : "bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>
          <Button variant={isLast ? "default" : "outline"} size="sm" onClick={handleNext} disabled={isLast} className="gap-1">
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Single step renderer ─────────────────────────────────────────────
function StepContent({ step, stepIndex }: { step: ExplanationStep; stepIndex: number }) {
  // Content rendered via renderMixedContent — same pattern used
  // throughout the codebase (ExplanationWindow, MultipleChoiceQuestion)
  // for rendering KaTeX math within HTML content
  const contentHtml = renderMixedContent(step.content);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
          {stepIndex + 1}
        </div>
        <h3 className="font-semibold text-base">{step.title.replace(/^Step\s*\d+\s*:\s*/i, "")}</h3>
      </div>

      <div className="text-sm leading-relaxed pl-9" dangerouslySetInnerHTML={{ __html: contentHtml }} />

      {step.formula && (
        <div className="ml-9 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="text-center" dangerouslySetInnerHTML={{ __html: renderMixedContent(step.formula) }} />
        </div>
      )}

      {step.highlights && step.highlights.length > 0 && (
        <div className="ml-9"><Highlights highlights={step.highlights} /></div>
      )}

      {step.graph && (
        <div className="ml-9"><MiniGraph graph={step.graph} /></div>
      )}

      {step.eliminationChoices && step.eliminationChoices.length > 0 && (
        <div className="ml-9"><EliminationDisplay choices={step.eliminationChoices} /></div>
      )}
    </div>
  );
}
