import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Paintbrush, RotateCcw, Type } from "lucide-react";

import { useThemeMode } from "@/hooks/useThemeMode";
import { usePersonalization } from "@/hooks/usePersonalization";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  DEFAULT_PERSONALIZATION,
  FONT_OPTIONS,
  TEXT_SIZE_OPTIONS,
  applyPersonalizationPreferences,
  getPersonalizationPreferences,
  type QuestionFontId,
  type QuestionTextSize,
} from "@/lib/personalization";

const Personalization = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isDarkMode = useThemeMode();
  const prefs = usePersonalization();
  const headingColor = isDarkMode ? "#f8fafc" : "#0f172a";
  const mutedColor = isDarkMode ? "rgba(226,232,240,0.72)" : "#64748b";
  const cardStyle = {
    backgroundColor: isDarkMode ? "rgba(15,23,42,0.84)" : "#ffffff",
    borderColor: isDarkMode ? "rgba(148,163,184,0.16)" : "rgba(15, 23, 42, 0.08)",
  };
  const setFont = (font: QuestionFontId) =>
    applyPersonalizationPreferences({ ...getPersonalizationPreferences(), font });
  const setTextSize = (textSize: QuestionTextSize) =>
    applyPersonalizationPreferences({ ...getPersonalizationPreferences(), textSize });
  const resetToDefaults = () =>
    applyPersonalizationPreferences(DEFAULT_PERSONALIZATION);

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <div
      className="min-h-screen p-6"
      style={{ backgroundColor: isDarkMode ? "hsl(var(--background))" : "#ffffff" }}
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/profile")}
              className="cursor-pointer"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Settings
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetToDefaults}
            className="cursor-pointer"
            style={{ color: mutedColor }}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset to defaults
          </Button>
        </div>

        <div className="mb-2">
          <h1
            style={{
              fontFamily: "'Geist', Georgia, serif",
              fontSize: "clamp(24px, 3vw, 32px)",
              fontWeight: 400,
              letterSpacing: "-0.02em",
              color: headingColor,
              margin: 0,
            }}
          >
            Personalization
          </h1>
          <p className="mt-1" style={{ color: mutedColor }}>
            Choose how question text looks across the app. Changes apply instantly.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-6">
            <Card style={cardStyle}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2" style={{ color: headingColor }}>
                  <Type className="h-5 w-5" />
                  Question Font
                </CardTitle>
                <CardDescription style={{ color: mutedColor }}>
                  Used for question stems, passages, and answer choices.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                  {FONT_OPTIONS.map((opt) => {
                    const selected = prefs.font === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFont(opt.id)}
                        className={cn(
                          "flex flex-col items-start gap-1 rounded-lg border-2 p-3 text-left transition-colors",
                          selected
                            ? "border-primary bg-primary/5 hover:bg-primary/10 dark:bg-primary/10 dark:hover:bg-primary/15"
                            : "border-border hover:bg-muted/40",
                        )}
                      >
                        <span
                          className="text-xs uppercase tracking-wide"
                          style={{ color: mutedColor }}
                        >
                          {opt.label}
                        </span>
                        <span
                          style={{
                            fontFamily: opt.stack,
                            fontSize: "1rem",
                            color: headingColor,
                          }}
                        >
                          The quick brown fox
                        </span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card style={cardStyle}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2" style={{ color: headingColor }}>
                  <Paintbrush className="h-5 w-5" />
                  Text Size
                </CardTitle>
                <CardDescription style={{ color: mutedColor }}>
                  Scales question and answer-choice text proportionally.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {TEXT_SIZE_OPTIONS.map((opt) => {
                    const selected = prefs.textSize === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setTextSize(opt.id)}
                        className={cn(
                          "flex flex-1 min-w-[80px] flex-col items-center gap-1 rounded-lg border-2 px-3 py-2 transition-colors",
                          selected
                            ? "border-primary bg-primary/5 hover:bg-primary/10 dark:bg-primary/10 dark:hover:bg-primary/15"
                            : "border-border hover:bg-muted/40",
                        )}
                      >
                        <span
                          style={{ fontSize: `${opt.scale}rem`, color: headingColor, lineHeight: 1 }}
                        >
                          Aa
                        </span>
                        <span className="text-xs" style={{ color: mutedColor }}>
                          {opt.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card style={cardStyle}>
            <CardHeader>
              <CardTitle style={{ color: headingColor }}>Live preview</CardTitle>
              <CardDescription style={{ color: mutedColor }}>
                Sample question rendered with your current selections.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PreviewQuestion isDarkMode={isDarkMode} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

const PREVIEW_STEM =
  "A rectangle has a length that is 3 more than twice its width. If the perimeter of the rectangle is 42 inches, what is its width in inches?";

const PREVIEW_CHOICES: { id: string; text: string }[] = [
  { id: "A", text: "6" },
  { id: "B", text: "7" },
  { id: "C", text: "9" },
  { id: "D", text: "12" },
];

const PreviewQuestion = ({ isDarkMode }: { isDarkMode: boolean }) => {
  const [selected, setSelected] = useState<string | null>(null);
  const borderColor = isDarkMode ? "rgba(148,163,184,0.2)" : "rgba(15,23,42,0.1)";
  const textColor = isDarkMode ? "#f8fafc" : "#0f172a";
  const mutedColor = isDarkMode ? "rgba(226,232,240,0.72)" : "#64748b";

  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor, backgroundColor: isDarkMode ? "rgba(15,23,42,0.4)" : "#fafafa" }}
    >
      <div className="mb-3 text-xs uppercase tracking-wide" style={{ color: mutedColor }}>
        Preview question
      </div>
      <div
        id="question-content"
        style={{
          color: textColor,
          marginBottom: "1rem",
          lineHeight: 1.73,
        }}
      >
        {PREVIEW_STEM}
      </div>
      <div className="space-y-2">
        {PREVIEW_CHOICES.map((choice) => {
          const isSelected = selected === choice.id;
          return (
            <button
              key={choice.id}
              type="button"
              onClick={() => setSelected(isSelected ? null : choice.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border-2 p-3 text-left transition-colors",
                isSelected
                  ? "border-primary bg-primary/5 hover:bg-primary/10 dark:bg-primary/10 dark:hover:bg-primary/15"
                  : "border-border hover:bg-muted/40",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/40",
                )}
                style={{ color: isSelected ? undefined : textColor }}
              >
                {choice.id}
              </span>
              <span className="choice-content" style={{ color: textColor, lineHeight: 1.54 }}>
                {choice.text}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Personalization;
