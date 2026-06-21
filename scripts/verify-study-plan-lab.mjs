import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import puppeteer from "puppeteer";

const baseUrl = process.env.STUDY_PLAN_LAB_URL ?? "http://127.0.0.1:8080";
const routeUrl = `${baseUrl}/study-plan-lab`;
const scoreReportFile = process.env.SCORE_REPORT_FILE;
const expectedScoreReportScores = process.env.SCORE_REPORT_EXPECTED?.split(",").map((value) => Number(value.trim()));
const storageKeys = [
  "1600now-study-plan-lab",
  "1600now-study-plan-progress",
  "1600now-study-plan-score-report",
  "1600now-study-plan-snapshot",
];

const scoreReportTextFixture = `
Your Score Report
Name: Example Student
SAT Scores
TOTAL SCORE
1230 400-1600 3 Year Average Score (all testers): 1037
Score Range: 1190-1270
SECTION SCORES
Reading and Writing
620 200-800 3 Year Average Score (all testers): 525
Your Score Range: 590-650
Math
610 200-800 3 Year Average Score (all testers): 512
Your Score Range: 580-640
Knowledge and Skills
Reading and Writing
Information and Ideas
(26% of test section, 12-14 questions)
Performance: 430-490
Craft and Structure
(28% of test section, 13-15 questions)
Performance: 610-670
Expression of Ideas
(20% of test section, 8-12 questions)
Performance: 490-540
Standard English Conventions
(26% of test section, 11-15 questions)
Performance: 680-800
Math
Algebra
(35% of test section, 13-15 questions)
Performance: 360-420
Advanced Math
(35% of test section, 13-15 questions)
Performance: 430-490
Problem-Solving and Data Analysis
(15% of test section, 5-7 questions)
Performance: 610-670
Geometry and Trigonometry
(15% of test section, 5-7 questions)
Performance: 680-800
`;

const domainBars = [
  ["Information and Ideas", "Reading and Writing", "12-14 questions", 2],
  ["Craft and Structure", "Reading and Writing", "13-15 questions", 5],
  ["Expression of Ideas", "Reading and Writing", "8-12 questions", 4],
  ["Standard English Conventions", "Reading and Writing", "11-15 questions", 6],
  ["Algebra", "Math", "13-15 questions", 1],
  ["Advanced Math", "Math", "13-15 questions", 3],
  ["Problem-Solving and Data Analysis", "Math", "5-7 questions", 5],
  ["Geometry and Trigonometry", "Math", "5-7 questions", 6],
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchOk = async (url) => {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
};

const waitForServer = async (url, timeoutMs = 45000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fetchOk(url)) return;
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${url}`);
};

const ensureServer = async () => {
  if (await fetchOk(routeUrl)) return null;
  const child = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", "8080"], {
    cwd: process.cwd(),
    stdio: "pipe",
    env: { ...process.env, BROWSER: "none" },
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  try {
    await waitForServer(routeUrl);
  } catch (error) {
    child.kill("SIGTERM");
    throw new Error(`${error.message}\n${output.slice(-4000)}`);
  }
  return child;
};

const createFixturePdf = async (browser) => {
  const fixturePath = path.join(os.tmpdir(), "study-plan-score-report-fixture.pdf");
  const page = await browser.newPage();
  const rows = domainBars
    .map(([domain, section, questions, bars]) => {
      const slots = Array.from({ length: 7 }, (_, index) => {
        const filled = index < bars;
        return `<span class="${filled ? "filled" : ""}"></span>`;
      }).join("");
      return `
        <div class="domain-row">
          <div>
            <div class="domain">${domain}</div>
            <div class="meta">${section} · ${questions}</div>
          </div>
          <div class="bar">${slots}</div>
        </div>
      `;
    })
    .join("");
  await page.setContent(`
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; color: #111827; margin: 34px; }
          h1 { font-size: 26px; margin: 0 0 16px; }
          h2 { font-size: 18px; margin: 22px 0 8px; }
          .scores { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 16px 0; }
          .score { border: 1px solid #d1d5db; border-radius: 10px; padding: 12px; }
          .label { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #4b5563; }
          .value { font-size: 34px; font-weight: 700; margin-top: 6px; }
          .domain-row { display: grid; grid-template-columns: 1fr 260px; align-items: center; gap: 24px; border-top: 1px solid #e5e7eb; padding: 10px 0; page-break-inside: avoid; }
          .domain { font-weight: 700; font-size: 15px; }
          .meta { font-size: 12px; color: #4b5563; margin-top: 2px; }
          .bar { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
          .bar span { height: 13px; border-radius: 999px; border: 1px solid #cbd5e1; background: #f8fafc; }
          .bar span.filled { border-color: #1d9bd7; background: #1d9bd7; }
        </style>
      </head>
      <body>
        <h1>Your Score Report</h1>
        <div class="scores">
          <div class="score"><div class="label">Total Score</div><div class="value">1230</div><div>400-1600</div></div>
          <div class="score"><div class="label">Reading and Writing</div><div class="value">620</div><div>200-800</div></div>
          <div class="score"><div class="label">Math</div><div class="value">610</div><div>200-800</div></div>
        </div>
        <h2>Knowledge and Skills</h2>
        ${rows}
      </body>
    </html>
  `, { waitUntil: "networkidle0" });
  await page.pdf({ path: fixturePath, format: "Letter", printBackground: true });
  await page.close();
  return fixturePath;
};

const clickButton = async (page, label) => {
  const found = await page.evaluate((text) => {
    const button = [...document.querySelectorAll("button")].find((candidate) => candidate.textContent?.trim() === text);
    button?.click();
    return Boolean(button);
  }, label);
  if (!found) throw new Error(`Button not found: ${label}`);
};

const assertCondition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const replaceInputText = async (page, selector, value) => {
  await page.click(selector, { clickCount: 3 });
  await page.keyboard.press("Backspace");
  await page.keyboard.type(value);
  await sleep(50);
};

const readUploadedReport = async (browser, logs, filePath) => {
  const page = await browser.newPage();
  page.on("console", (message) => logs.push(`${message.type()}: ${message.text()}`));
  page.on("pageerror", (error) => logs.push(`pageerror: ${error.message}`));
  try {
    await page.goto(routeUrl, { waitUntil: "networkidle0", timeout: 60000 });
    await page.evaluate((keys) => keys.forEach((key) => localStorage.removeItem(key)), storageKeys);
    await page.reload({ waitUntil: "networkidle0", timeout: 60000 });
    await (await page.$('input[type="file"]')).uploadFile(filePath);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("1600now-study-plan-score-report") || "null")?.parsed, { timeout: 120000 });
    return page.evaluate(() => {
      const report = JSON.parse(localStorage.getItem("1600now-study-plan-score-report"));
      return {
        scores: [report.parsed.totalScore, report.parsed.readingWritingScore, report.parsed.mathScore],
        warnings: report.parsed.warnings,
        source: report.parsed.source,
        domainMetrics: report.parsed.domains.filter((domain) => typeof domain.proficiency === "number").length,
        recommendedFocus: report.parsed.recommendedFocus,
        storedSanitized:
          report.name === "Score report" &&
          report.size === 0 &&
          report.parsed.fileName === "Score report" &&
          report.parsed.extractedText.length === 0 &&
          report.parsed.domains.every((domain) => domain.rawContext.length === 0),
      };
    });
  } finally {
    await page.close().catch(() => undefined);
  }
};

const run = async () => {
  const server = await ensureServer();
  const browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1440, height: 1024 } });
  const artifacts = {
    fixturePdf: "",
    setup: path.join(os.tmpdir(), "study-plan-verify-setup.png"),
    calendar: path.join(os.tmpdir(), "study-plan-verify-calendar.png"),
    mobile: path.join(os.tmpdir(), "study-plan-verify-mobile.png"),
    print: path.join(os.tmpdir(), "study-plan-verify-print.png"),
    result: path.join(os.tmpdir(), "study-plan-verify-result.json"),
  };
  const logs = [];

  try {
    artifacts.fixturePdf = await createFixturePdf(browser);
    const uploadedScoreReport = scoreReportFile ? await readUploadedReport(browser, logs, scoreReportFile) : null;
    if (uploadedScoreReport) {
      assertCondition(uploadedScoreReport.scores.every((score) => Number.isFinite(score)), "Uploaded score report scores failed");
      if (expectedScoreReportScores) {
        assertCondition(JSON.stringify(uploadedScoreReport.scores) === JSON.stringify(expectedScoreReportScores), "Uploaded score report scores did not match expected values");
      }
      assertCondition(uploadedScoreReport.scores[0] === uploadedScoreReport.scores[1] + uploadedScoreReport.scores[2], "Uploaded score report section scores do not match total");
      assertCondition(uploadedScoreReport.domainMetrics >= 4, "Uploaded score report domain bars failed");
      assertCondition(uploadedScoreReport.storedSanitized, "Uploaded score report was not sanitized");
    }
    const page = await browser.newPage();
    page.on("console", (message) => logs.push(`${message.type()}: ${message.text()}`));
    page.on("pageerror", (error) => logs.push(`pageerror: ${error.message}`));
    await page.goto(routeUrl, { waitUntil: "networkidle0", timeout: 60000 });
    await page.evaluate((keys) => keys.forEach((key) => localStorage.removeItem(key)), storageKeys);
    await page.reload({ waitUntil: "networkidle0", timeout: 60000 });
    await page.waitForFunction(() => Boolean(localStorage.getItem("1600now-study-plan-lab")), { timeout: 10000 });

    await replaceInputText(page, 'input[aria-label="RW"]', "abc");
    const invalidDraft = await page.$eval('input[aria-label="RW"]', (input) => input.value);
    const invalidMidSetting = await page.evaluate(() => JSON.parse(localStorage.getItem("1600now-study-plan-lab")).currentReadingWriting);
    await page.$eval('input[aria-label="RW"]', (input) => input.blur());
    await sleep(50);
    const invalidBlurValue = await page.$eval('input[aria-label="RW"]', (input) => input.value);
    const invalidBlurSetting = await page.evaluate(() => JSON.parse(localStorage.getItem("1600now-study-plan-lab")).currentReadingWriting);

    await replaceInputText(page, 'input[aria-label="RW"]', "795");
    const validDraft = await page.$eval('input[aria-label="RW"]', (input) => input.value);
    const validMidSetting = await page.evaluate(() => JSON.parse(localStorage.getItem("1600now-study-plan-lab")).currentReadingWriting);
    await page.$eval('input[aria-label="RW"]', (input) => input.blur());
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("1600now-study-plan-lab")).currentReadingWriting === 790, { timeout: 10000 });
    const validBlurValue = await page.$eval('input[aria-label="RW"]', (input) => input.value);
    const validBlurSetting = await page.evaluate(() => JSON.parse(localStorage.getItem("1600now-study-plan-lab")).currentReadingWriting);

    await replaceInputText(page, 'input[aria-label="RW"]', "1200");
    const extraLeadingDraft = await page.$eval('input[aria-label="RW"]', (input) => input.value);
    const extraLeadingMidSetting = await page.evaluate(() => JSON.parse(localStorage.getItem("1600now-study-plan-lab")).currentReadingWriting);
    await page.$eval('input[aria-label="RW"]', (input) => input.blur());
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("1600now-study-plan-lab")).currentReadingWriting === 200, { timeout: 10000 });
    const extraLeadingBlurValue = await page.$eval('input[aria-label="RW"]', (input) => input.value);
    const extraLeadingBlurSetting = await page.evaluate(() => JSON.parse(localStorage.getItem("1600now-study-plan-lab")).currentReadingWriting);

    await replaceInputText(page, 'input[aria-label="RW"]', "8000");
    const extraTrailingDraft = await page.$eval('input[aria-label="RW"]', (input) => input.value);
    const extraTrailingMidSetting = await page.evaluate(() => JSON.parse(localStorage.getItem("1600now-study-plan-lab")).currentReadingWriting);
    await page.$eval('input[aria-label="RW"]', (input) => input.blur());
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("1600now-study-plan-lab")).currentReadingWriting === 800, { timeout: 10000 });
    const extraTrailingBlurValue = await page.$eval('input[aria-label="RW"]', (input) => input.value);
    const extraTrailingBlurSetting = await page.evaluate(() => JSON.parse(localStorage.getItem("1600now-study-plan-lab")).currentReadingWriting);

    await replaceInputText(page, 'input[aria-label="RW"]', "8002");
    const extraTrailingDigitDraft = await page.$eval('input[aria-label="RW"]', (input) => input.value);
    const extraTrailingDigitMidSetting = await page.evaluate(() => JSON.parse(localStorage.getItem("1600now-study-plan-lab")).currentReadingWriting);
    await page.$eval('input[aria-label="RW"]', (input) => input.blur());
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("1600now-study-plan-lab")).currentReadingWriting === 800, { timeout: 10000 });
    const extraTrailingDigitBlurValue = await page.$eval('input[aria-label="RW"]', (input) => input.value);
    const extraTrailingDigitBlurSetting = await page.evaluate(() => JSON.parse(localStorage.getItem("1600now-study-plan-lab")).currentReadingWriting);

    await page.hover('input[aria-label="Goal score"]');
    await sleep(50);
    const goalHoverMinusHovered = await page.$eval('button[aria-label="Decrease Goal score"]', (button) => button.matches(":hover"));

    const dateSelector = await page.evaluate(() => {
      const satSelect = document.querySelector("select");
      const options = [...(satSelect?.querySelectorAll("option") ?? [])].map((option) => option.textContent?.trim() ?? "");
      return {
        selectCount: document.querySelectorAll("select").length,
        dateInputCount: document.querySelectorAll('input[type="date"]').length,
        value: satSelect?.value,
        options,
        monthOnlyOptions: options.every((label) => /^[A-Z][a-z]+ 20\d{2}$/.test(label)),
        includesJune2027: options.includes("June 2027"),
        excludesAfterJune2027: !options.some((label) => /August 2027|September 2027|October 2027|November 2027|December 2027/.test(label)),
      };
    });

    const scoreTyping = {
      invalidDraft,
      invalidMidSetting,
      invalidBlurValue,
      invalidBlurSetting,
      validDraft,
      validMidSetting,
      validBlurValue,
      validBlurSetting,
      extraLeadingDraft,
      extraLeadingMidSetting,
      extraLeadingBlurValue,
      extraLeadingBlurSetting,
      extraTrailingDraft,
      extraTrailingMidSetting,
      extraTrailingBlurValue,
      extraTrailingBlurSetting,
      extraTrailingDigitDraft,
      extraTrailingDigitMidSetting,
      extraTrailingDigitBlurValue,
      extraTrailingDigitBlurSetting,
      goalHoverMinusHovered,
    };

    const textParsed = await page.evaluate(async (fixture) => {
      const mod = await import("/src/lib/studyPlan/scoreReportParser.ts");
      const parsed = mod.parseScoreReportText(fixture, "fixture.pdf", "pdf-text");
      return {
        scores: [parsed.totalScore, parsed.readingWritingScore, parsed.mathScore],
        domainEvidence: parsed.domains.filter((domain) => typeof domain.proficiency === "number").length,
        recommendedFocus: parsed.recommendedFocus,
        warnings: parsed.warnings,
      };
    }, scoreReportTextFixture);

    await (await page.$('input[type="file"]')).uploadFile(artifacts.fixturePdf);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("1600now-study-plan-score-report") || "null")?.parsed, { timeout: 120000 });
    await page.screenshot({ path: artifacts.setup, fullPage: true });
    const setupUi = await page.evaluate(() => {
      const text = document.body.innerText;
      const buttonLabels = [...document.querySelectorAll("button")].map((button) => button.textContent?.trim());
      const settings = JSON.parse(localStorage.getItem("1600now-study-plan-lab"));
      return {
        hasReportReadout: /\b(?:Read|Partially read)\s+\d+/.test(text),
        hasHelpDisclosure: text.includes("Need help finding your report?"),
        hasBalancedFocusButton: buttonLabels.includes("Balanced"),
        hasErrorLogText: text.includes("Error Log"),
        hasBackToDashboard: buttonLabels.includes("Back to dashboard"),
        hasHumanStartCopy: text.includes("When do you want to start?"),
        hasTightenOption: text.includes("Tighten module timing"),
        focus: settings.focus,
      };
    });
    await page.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes("Tighten module timing"));
      button?.click();
    });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("1600now-study-plan-lab")).pacingMode === "tighten", { timeout: 10000 });
    await clickButton(page, "Create plan");
    await page.waitForFunction(() => document.body.innerText.includes("Study dashboard"), { timeout: 60000 });

    const initial = await page.evaluate(() => {
      const report = JSON.parse(localStorage.getItem("1600now-study-plan-score-report"));
      const tasks = JSON.parse(localStorage.getItem("1600now-study-plan-snapshot"));
      const settings = JSON.parse(localStorage.getItem("1600now-study-plan-lab"));
      const dailyTotals = Object.values(tasks.reduce((acc, task) => {
        acc[task.date] = (acc[task.date] || 0) + task.minutes;
        return acc;
      }, {}));
      const bodyText = document.body.innerText;
      return {
        report: {
          name: report.name,
          size: report.size,
          fileName: report.parsed.fileName,
          scores: [report.parsed.totalScore, report.parsed.readingWritingScore, report.parsed.mathScore],
          warnings: report.parsed.warnings,
          extractedTextLength: report.parsed.extractedText.length,
          rawContextLengths: report.parsed.domains.map((domain) => domain.rawContext.length),
          domainBars: report.parsed.domains.map((domain) => [domain.id, domain.proficiency]),
        },
        plan: {
          taskCount: tasks.length,
          totalMinutes: tasks.reduce((sum, task) => sum + task.minutes, 0),
          hasErrorLogTask: tasks.some((task) => /Error Log|error-log/i.test(`${task.title} ${task.focus}`)),
          dailyTotals,
          dailyBudget: settings.minutesPerDay,
          dailyTotalsMatch: dailyTotals.length > 0 && dailyTotals.every((total) => total === settings.minutesPerDay),
          hasBankSetActions: tasks.some((task) => task.action?.kind === "bank-set" && task.action.questionCount > 0),
          hasModuleActions: tasks.some((task) => task.action?.kind === "module" && task.action.moduleSlug && task.action.timeLimitMinutes > 0),
          hasTightenedModule: tasks.some((task) => task.action?.kind === "module" && task.action.timeLimitMinutes < 35),
          hasVocabText: /vocab|Words in Context/i.test(JSON.stringify(tasks)),
          hasDomainBrowseLink: [...document.querySelectorAll("a")].some((link) => /\/bank\/(?:math|reading)\/domain\//.test(link.getAttribute("href") || "")),
          hasStartAssignmentButton: [...document.querySelectorAll("button")].some((button) => /^Start /.test(button.textContent?.trim() || "")),
        },
        hasShellNav: bodyText.includes("Question Bank\n100 Hard Math") || bodyText.includes("Replay tour"),
        confidenceVisibleBeforeDone: /\bHard\b[\s\S]*\bOkay\b[\s\S]*\bEasy\b/.test(bodyText),
      };
    });

    await page.evaluate(() => document.querySelector('[role="checkbox"]')?.click());
    const beforeEdit = await page.evaluate(() => {
      const progress = JSON.parse(localStorage.getItem("1600now-study-plan-progress"));
      const tasks = JSON.parse(localStorage.getItem("1600now-study-plan-snapshot"));
      const completedId = Object.keys(progress.completed).find((id) => progress.completed[id]);
      const completedDate = tasks.find((task) => task.id === completedId)?.date;
      return {
        completedId,
        completedDate,
        completedDayIds: tasks.filter((task) => task.date === completedDate).map((task) => task.id),
      };
    });

    await clickButton(page, "Edit schedule");
    await page.waitForFunction(() => document.body.innerText.includes("Save schedule"), { timeout: 60000 });
    for (let target = 1460; target <= 1600; target += 10) {
      await page.evaluate(() => document.querySelector('button[aria-label="Increase Goal score"]')?.click());
      await page.waitForFunction((expected) => JSON.parse(localStorage.getItem("1600now-study-plan-lab")).targetScore === expected, { timeout: 10000 }, target);
    }
    await clickButton(page, "Save schedule");
    await page.waitForFunction(() => document.body.innerText.includes("Study dashboard"), { timeout: 60000 });

    const afterEdit = await page.evaluate((completedDate) => {
      const settings = JSON.parse(localStorage.getItem("1600now-study-plan-lab"));
      const tasks = JSON.parse(localStorage.getItem("1600now-study-plan-snapshot"));
      const dailyTotals = Object.values(tasks.reduce((acc, task) => {
        acc[task.date] = (acc[task.date] || 0) + task.minutes;
        return acc;
      }, {}));
      return {
        targetScore: settings.targetScore,
        totalMinutes: tasks.reduce((sum, task) => sum + task.minutes, 0),
        dailyTotalsMatch: dailyTotals.length > 0 && dailyTotals.every((total) => total === settings.minutesPerDay),
        completedDayIds: tasks.filter((task) => task.date === completedDate).map((task) => task.id),
      };
    }, beforeEdit.completedDate);

    await page.waitForFunction(() => document.body.innerText.includes("Daily calendar"), { timeout: 60000 });
    await page.evaluate(() => {
      const dayButton = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("16") && button.textContent?.includes("task"));
      dayButton?.click();
    });
    await page.screenshot({ path: artifacts.calendar, fullPage: true });
    const calendar = await page.evaluate(() => {
      const text = document.body.innerText;
      const buttonLabels = [...document.querySelectorAll("button")].map((button) => button.textContent?.trim() ?? "");
      return {
        hasCombinedArea: text.includes("Today and calendar") && text.includes("This week") && text.includes("Daily calendar"),
        hasPrint: text.includes("Print"),
        hasIcsOrJson: /\bICS\b|calendar file|Download JSON/.test(text),
        selectedText: text.includes("Tuesday, June 16, 2026"),
        tabsRemoved: !["Today", "Calendar", "Progress", "Edit"].some((label) => buttonLabels.includes(label)),
        progressContentRemoved: !text.includes("Progress and rebalancing") && !text.includes("Adaptive flags"),
      };
    });

    const launchPage = await browser.newPage();
    await launchPage.goto(routeUrl, { waitUntil: "networkidle0", timeout: 60000 });
    await launchPage.waitForFunction(() => document.body.innerText.includes("Study dashboard"), { timeout: 60000 });
    await launchPage.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find((item) => /^Start /.test(item.textContent?.trim() || ""));
      button?.click();
    });
    await launchPage.waitForFunction(() => location.pathname.startsWith("/bank/") && new URL(location.href).searchParams.get("practice") === "true", { timeout: 60000 });
    const launch = await launchPage.evaluate(() => {
      const practiceSet = JSON.parse(sessionStorage.getItem("practiceSet") || "[]");
      return {
        url: location.href,
        hasDomainPath: /\/bank\/(?:math|reading)\/domain\//.test(location.pathname),
        practiceSetLength: practiceSet.length,
        firstHasSourceId: Boolean(practiceSet[0]?.sourceId),
        exitTo: sessionStorage.getItem("practiceExitTo"),
        runId: sessionStorage.getItem("practiceRunId"),
      };
    });
    await launchPage.close();

    const mobilePage = await browser.newPage();
    await mobilePage.setViewport({ width: 390, height: 900, deviceScaleFactor: 2 });
    await mobilePage.goto(routeUrl, { waitUntil: "networkidle0", timeout: 60000 });
    await mobilePage.screenshot({ path: artifacts.mobile, fullPage: true });
    const mobile = await mobilePage.evaluate(() => {
      const text = document.body.innerText;
      return {
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        selectedBeforeWeek: text.indexOf("Tuesday, June 16, 2026") !== -1 && text.indexOf("This week") !== -1
          ? text.indexOf("Tuesday, June 16, 2026") < text.indexOf("This week")
          : text.indexOf("Monday, June 15, 2026") < text.indexOf("This week"),
      };
    });
    await mobilePage.close();

    await page.emulateMediaType("print");
    await page.screenshot({ path: artifacts.print, fullPage: true });
    const print = await page.evaluate(() => {
      const aside = document.querySelector("aside");
      const root = document.querySelector("[data-study-plan-lab]");
      const text = document.body.innerText;
      return {
        asideDisplay: aside ? getComputedStyle(aside).display : "missing",
        left: root ? Math.round(root.getBoundingClientRect().left) : null,
        hasNavText: text.includes("Question Bank"),
        hasDailyPlan: text.includes("Daily SAT Plan"),
        hasTaskDetails: text.includes("Baseline score report review") && text.includes("Score report priorities"),
      };
    });

    const result = {
      textParsed,
      scoreTyping,
      dateSelector,
      setupUi,
      initial,
      beforeEdit,
      afterEdit,
      calendar,
      launch,
      mobile,
      print,
      uploadedScoreReport,
      artifacts,
      logs,
    };

    await writeFile(artifacts.result, JSON.stringify(result, null, 2));

    assertCondition(JSON.stringify(textParsed.scores) === JSON.stringify([1230, 620, 610]), "Text fixture scores failed");
    assertCondition(textParsed.domainEvidence >= 8 && textParsed.warnings.length === 0, "Text fixture domain evidence failed");
    assertCondition(scoreTyping.invalidDraft === "abc" && scoreTyping.invalidMidSetting === 620, "Invalid score draft changed stored value while typing");
    assertCondition(scoreTyping.invalidBlurValue === "620" && scoreTyping.invalidBlurSetting === 620, "Invalid score draft did not revert on blur");
    assertCondition(scoreTyping.validDraft === "795" && scoreTyping.validMidSetting === 620, "Valid score draft changed stored value while typing");
    assertCondition(scoreTyping.validBlurValue === "790" && scoreTyping.validBlurSetting === 790, "Valid score draft did not commit truncated value on blur");
    assertCondition(scoreTyping.extraLeadingDraft === "1200" && scoreTyping.extraLeadingMidSetting === 790 && scoreTyping.extraLeadingBlurValue === "200" && scoreTyping.extraLeadingBlurSetting === 200, "1200 score typo did not normalize to 200");
    assertCondition(scoreTyping.extraTrailingDraft === "8000" && scoreTyping.extraTrailingMidSetting === 200 && scoreTyping.extraTrailingBlurValue === "800" && scoreTyping.extraTrailingBlurSetting === 800, "8000 score typo did not normalize to 800");
    assertCondition(scoreTyping.extraTrailingDigitDraft === "8002" && scoreTyping.extraTrailingDigitMidSetting === 800 && scoreTyping.extraTrailingDigitBlurValue === "800" && scoreTyping.extraTrailingDigitBlurSetting === 800, "8002 score typo did not normalize to 800");
    assertCondition(!scoreTyping.goalHoverMinusHovered, "Goal input hover is still hovering the decrease button");
    assertCondition(dateSelector.selectCount === 1 && dateSelector.dateInputCount === 1 && dateSelector.monthOnlyOptions && dateSelector.includesJune2027 && dateSelector.excludesAfterJune2027, "SAT date selector failed");
    assertCondition(!setupUi.hasReportReadout && !setupUi.hasHelpDisclosure && !setupUi.hasBalancedFocusButton && !setupUi.hasErrorLogText && !setupUi.hasBackToDashboard && setupUi.hasHumanStartCopy && setupUi.hasTightenOption, "Setup UI cleanup failed");
    assertCondition(!setupUi.focus.includes("Error Log"), "Settings focus still includes Error Log");
    assertCondition(JSON.stringify(initial.report.scores) === JSON.stringify([1230, 620, 610]), "PDF upload scores failed");
    assertCondition(!initial.hasShellNav, "Hidden route is still rendering app navigation");
    assertCondition(initial.report.domainBars.length === 8 && initial.report.domainBars.every(([, bars]) => typeof bars === "number"), "PDF upload bars failed");
    assertCondition(initial.report.extractedTextLength === 0 && initial.report.rawContextLengths.every((length) => length === 0), "Stored report text was not sanitized");
    assertCondition(initial.report.fileName === "Score report" && initial.report.name === "Score report" && initial.report.size === 0, "Stored report metadata was not sanitized");
    assertCondition(!initial.plan.hasErrorLogTask, "Generated plan still includes Error Log tasks");
    assertCondition(initial.plan.dailyTotalsMatch && initial.plan.hasBankSetActions && initial.plan.hasModuleActions && initial.plan.hasTightenedModule, "Generated plan does not satisfy timing/action requirements");
    assertCondition(!initial.plan.hasVocabText && !initial.plan.hasDomainBrowseLink && initial.plan.hasStartAssignmentButton, "Generated plan still has vocab, browse links, or missing start buttons");
    assertCondition(!initial.confidenceVisibleBeforeDone, "Confidence controls visible before completion");
    assertCondition(afterEdit.targetScore === 1600 && afterEdit.dailyTotalsMatch, "Edited schedule did not preserve daily time budget");
    assertCondition(JSON.stringify(afterEdit.completedDayIds) === JSON.stringify(beforeEdit.completedDayIds), "Completed day was not preserved");
    assertCondition(calendar.hasCombinedArea && calendar.hasPrint && !calendar.hasIcsOrJson && calendar.selectedText && calendar.tabsRemoved && calendar.progressContentRemoved, "Calendar combined-area behavior failed");
    assertCondition(launch.practiceSetLength > 0 && launch.firstHasSourceId && launch.exitTo === "/study-plan-lab" && !launch.hasDomainPath && launch.url.includes("practice=true"), "Direct task launch failed");
    assertCondition(!mobile.overflow && mobile.selectedBeforeWeek, "Mobile layout failed");
    assertCondition(print.asideDisplay === "none" && print.left === 0 && !print.hasNavText && print.hasDailyPlan && print.hasTaskDetails, "Print layout failed");

    console.log(JSON.stringify({ ok: true, artifacts }, null, 2));
  } finally {
    await browser.close().catch(() => undefined);
    if (server) server.kill("SIGTERM");
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
