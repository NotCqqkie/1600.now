import { useMemo, useState } from "react";

import { satToolBySlug } from "@/lib/seo-data/satTools";
import {
  COLLEGE_BOARD_SAT_DATES_URL,
  OFFICIAL_SAT_DATES,
  SAT_FACTS_VERIFIED_ON,
} from "@/lib/seo-data/satOfficialData";

import {
  SatToolPageScaffold,
  TOOL_FORM_CARD_CLASS,
  TOOL_INPUT_CLASS,
  TOOL_SECTION_HEADING_CLASS,
} from "./SatToolPageScaffold";
const daysBetween = (from: Date, to: Date): number => {
  const ms = to.getTime() - from.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
};

const SatTestCountdown = () => {
  const meta = satToolBySlug.get("sat-test-countdown")!;
  const today = useMemo(() => {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    return todayDate;
  }, []);

  const upcoming = useMemo(
    () =>
      OFFICIAL_SAT_DATES.filter(
        (t) => new Date(`${t.date}T00:00:00`).getTime() >= today.getTime(),
      ),
    [today],
  );

  const [selected, setSelected] = useState<string>(
    upcoming[0]?.date ?? OFFICIAL_SAT_DATES[0].date,
  );

  const selectedDate = new Date(`${selected}T00:00:00`);
  const days = daysBetween(today, selectedDate);
  const weeks = Math.floor(days / 7);
  const remainderDays = days % 7;

  const faqs = [
    {
      question: "When is the next SAT test date?",
      answer:
        upcoming.length > 0
          ? `The next Digital SAT administration is ${upcoming[0].label}.`
          : "Check College Board for the most recent test date schedule.",
    },
    {
      question: "How far in advance should I register for the SAT?",
      answer:
        "Register 4–5 weeks before your test date to avoid late fees and to secure your preferred test center. Popular centers fill quickly in the fall.",
    },
    {
      question: "Is the SAT offered every month?",
      answer:
        "No. The current August 2026–June 2027 College Board schedule has eight weekend dates: August, September, October, November, December, March, May, and June. The listed dates apply to US and international students.",
    },
    {
      question: "What if my target date passes?",
      answer:
        "Select the next available date. The countdown automatically hides dates that have already passed.",
    },
  ];

  return (
    <SatToolPageScaffold meta={meta} faqs={faqs}>
      <div className={TOOL_FORM_CARD_CLASS}>
        <label className="text-sm font-semibold">Your target SAT date</label>
        <select
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          className={TOOL_INPUT_CLASS}
        >
          {upcoming.map((testDate) => (
            <option key={testDate.date} value={testDate.date}>
              {testDate.label}
            </option>
          ))}
        </select>

        <div className="mt-6">
          <div className="text-sm text-muted-foreground">Days until test</div>
          <div className="text-5xl font-semibold">{Math.max(0, days)}</div>
          {days > 0 && (
            <div className="mt-1 text-sm text-muted-foreground">
              {weeks} week{weeks === 1 ? "" : "s"}
              {remainderDays > 0
                ? ` and ${remainderDays} day${remainderDays === 1 ? "" : "s"}`
                : ""}
            </div>
          )}
        </div>
      </div>

      <section className="mt-10">
        <h2 className={TOOL_SECTION_HEADING_CLASS}>
          Official August 2026–June 2027 SAT dates and deadlines
        </h2>
        <ul className="mt-4 space-y-2 text-muted-foreground">
          {OFFICIAL_SAT_DATES.map((testDate) => {
            const daysUntilTest = daysBetween(today, new Date(`${testDate.date}T00:00:00`));
            const passed = daysUntilTest < 0;
            return (
              <li
                key={testDate.date}
                className="flex items-center justify-between border-b border-border/40 py-2"
              >
                <span className={passed ? "line-through" : ""}>{testDate.label}</span>
                <span className="text-right text-sm">
                  <span className="block">
                    {passed ? "Past" : `${daysUntilTest} day${daysUntilTest === 1 ? "" : "s"}`}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Register by {testDate.registrationDeadline}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Verified {SAT_FACTS_VERIFIED_ON}. Deadlines expire at 11:59 p.m. ET.
          Check{" "}
          <a
            className="underline"
            href={COLLEGE_BOARD_SAT_DATES_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            satsuite.collegeboard.org/sat/dates-deadlines
          </a>{" "}
          for the latest confirmed dates and registration deadlines.
        </p>
      </section>

      <section className="mt-10">
        <h2 className={TOOL_SECTION_HEADING_CLASS}>
          How to plan backwards from a test date
        </h2>
        <ul className="mt-3 list-disc space-y-1 pl-6 text-muted-foreground">
          <li>
            <strong>12+ weeks out:</strong> baseline diagnostic + content
            review on weakest skills.
          </li>
          <li>
            <strong>6–8 weeks out:</strong> mixed-skill timed drills, one full
            mock per week.
          </li>
          <li>
            <strong>2 weeks out:</strong> taper — light review, no new hard
            content.
          </li>
          <li>
            <strong>Week of:</strong> Bluebook check, sleep schedule, no new
            material.
          </li>
        </ul>
      </section>

    </SatToolPageScaffold>
  );
};

export default SatTestCountdown;
