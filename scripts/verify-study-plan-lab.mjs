import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import axe from "axe-core";
import puppeteer from "puppeteer";

const baseUrl = process.env.STUDY_PLAN_LAB_URL ?? "http://127.0.0.1:8080";
const publicUrl = `${baseUrl}/sat-study-plan-generator`;
const legacyUrl = `${baseUrl}/study-plan-lab`;
const fixedToday = process.env.STUDY_PLAN_TEST_TODAY ?? "2026-07-09";
const v2Key = "1600now-study-plan:v2:anon";
const anonymousClaimKey = "1600now-study-plan-anonymous-claim:v2";
const artifacts = {
  setup: path.join(os.tmpdir(), "study-plan-verify-setup.png"),
  dashboard: path.join(os.tmpdir(), "study-plan-verify-dashboard.png"),
  mobile: path.join(os.tmpdir(), "study-plan-verify-mobile.png"),
  print: path.join(os.tmpdir(), "study-plan-verify-print.png"),
  fixture: path.join(os.tmpdir(), "study-plan-score-report-fixture.pdf"),
  imageFixture: path.join(os.tmpdir(), "study-plan-score-report-fixture.png"),
  malformedFixture: path.join(os.tmpdir(), "study-plan-unrelated-fixture.pdf"),
  result: path.join(os.tmpdir(), "study-plan-verify-result.json"),
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const fetchOk = async (url) => {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
};

const ensureServer = async () => {
  if (await fetchOk(publicUrl)) return null;
  const child = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", "8080"], {
    cwd: process.cwd(),
    stdio: "pipe",
    env: { ...process.env, BROWSER: "none" },
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });
  const startedAt = Date.now();
  while (Date.now() - startedAt < 45_000) {
    if (await fetchOk(publicUrl)) return child;
    await sleep(400);
  }
  child.kill("SIGTERM");
  throw new Error(`Timed out waiting for the dev server.\n${output.slice(-4000)}`);
};

const installFixedClock = async (page) => {
  await page.evaluateOnNewDocument((dateKey) => {
    const RealDate = Date;
    const timestamp = new RealDate(`${dateKey}T12:00:00`).getTime();
    class FixedDate extends RealDate {
      constructor(...args) {
        super(...(args.length ? args : [timestamp]));
      }
      static now() { return timestamp; }
    }
    window.Date = FixedDate;
  }, fixedToday);
};

const clearPlannerState = async (page) => {
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.includes("study-plan")) localStorage.removeItem(key);
    }
    sessionStorage.clear();
  });
};

const openCleanPage = async (browser, viewport = { width: 1440, height: 1000 }) => {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await installFixedClock(page);
  await page.goto(publicUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await clearPlannerState(page);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector("[data-study-plan-lab]", { timeout: 60_000 });
  await page.waitForSelector('input[type="file"]', { timeout: 60_000 });
  return page;
};

const clickExact = async (page, label) => {
  await page.waitForFunction((text) => [...document.querySelectorAll("button")].some((item) =>
    (item.textContent?.trim() === text || item.getAttribute("aria-label") === text)
    && item.getClientRects().length > 0), { timeout: 20_000 }, label);
  const clicked = await page.evaluate((text) => {
    const button = [...document.querySelectorAll("button")].find((item) =>
      (item.textContent?.trim() === text || item.getAttribute("aria-label") === text)
      && item.getClientRects().length > 0);
    button?.click();
    return Boolean(button);
  }, label);
  assert(clicked, `Button not found: ${label}`);
};

const createFixturePdf = async (browser) => {
  const page = await browser.newPage();
  await page.setContent(`
    <style>html,body{background:#fff}body{font:18px Arial;margin:32px;color:#111}h1{font-size:30px}.scores{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.score,.domain{border:1px solid #777;border-radius:8px;padding:12px;background:#fff}.value{font-size:34px;font-weight:700}.domain{margin-top:10px}</style>
    <h1>Your SAT Score Report</h1>
    <div class="scores">
      <div class="score">Total Score<div class="value">1230</div><div>400-1600</div></div>
      <div class="score">Reading and Writing<div class="value">620</div><div>200-800</div></div>
      <div class="score">Math<div class="value">610</div><div>200-800</div></div>
    </div>
    <h2>Knowledge and Skills</h2>
    <h3>Reading and Writing</h3>
    <div class="domain">Information and Ideas<br>12-14 questions<br>Performance: 200-360</div>
    <div class="domain">Craft and Structure<br>13-15 questions<br>Performance: 610-670</div>
    <div class="domain">Expression of Ideas<br>8-12 questions<br>Performance: 420-480</div>
    <div class="domain">Standard English Conventions<br>11-15 questions<br>Performance: 680-800</div>
    <h3>Math</h3>
    <div class="domain">Algebra<br>13-15 questions<br>Performance: 200-360</div>
    <div class="domain">Advanced Math<br>13-15 questions<br>Performance: 420-460</div>
    <div class="domain">Problem-Solving and Data Analysis<br>5-7 questions<br>Performance: 610-670</div>
    <div class="domain">Geometry and Trigonometry<br>5-7 questions<br>Performance: 680-800</div>
  `);
  await page.screenshot({ path: artifacts.imageFixture, fullPage: true });
  await page.pdf({ path: artifacts.fixture, format: "Letter", printBackground: true });
  await page.setContent("<h1>Neighborhood gardening notes</h1><p>Water tomatoes twice each week. No SAT scores are included in this document.</p>");
  await page.pdf({ path: artifacts.malformedFixture, format: "Letter", printBackground: true });
  await page.close();
};

const inspectControls = (page) => page.evaluate(() => {
  const visible = (element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  };
  const unlabeledControls = [...document.querySelectorAll("button,input,select,[role=checkbox],[role=slider]")]
    .filter(visible)
    .filter((element) => {
      if (element instanceof HTMLButtonElement && element.textContent?.trim()) return false;
      const id = element.getAttribute("id");
      return !element.getAttribute("aria-label")
        && !element.getAttribute("aria-labelledby")
        && !(id && document.querySelector(`label[for="${CSS.escape(id)}"]`))
        && !element.closest("label");
    })
    .map((element) => element.outerHTML.slice(0, 180));
  const smallTargets = [...document.querySelectorAll("[data-study-plan-lab] button")]
    .filter(visible)
    .map((element) => ({ element, rect: element.getBoundingClientRect() }))
    .filter(({ element, rect }) => {
      if (element.getAttribute("role") === "checkbox" && getComputedStyle(element, "::after").content !== "none") return false;
      return rect.width < 44 || rect.height < 44;
    })
    .map(({ element, rect }) => `${element.textContent?.trim() || element.getAttribute("aria-label")}: ${Math.round(rect.width)}x${Math.round(rect.height)}`);
  return { unlabeledControls, smallTargets };
});

const inspectA11y = async (page, selector = "[data-study-plan-lab]") => {
  const hasAxe = await page.evaluate(() => Boolean(window.axe));
  if (!hasAxe) await page.addScriptTag({ content: axe.source });
  return page.evaluate(async (targetSelector) => {
    const root = targetSelector ? document.querySelector(targetSelector) : document;
    const result = await window.axe.run(root);
    return result.violations
      .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
      .map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        targets: violation.nodes.flatMap((node) => node.target),
        nodes: violation.nodes.map((node) => ({
          target: node.target,
          html: node.html,
          summary: node.failureSummary,
        })),
      }));
  }, selector);
};

const run = async () => {
  const server = await ensureServer();
  const browser = await puppeteer.launch({ headless: true });
  const logs = [];
  try {
    await createFixturePdf(browser);

    const page = await openCleanPage(browser);
    page.on("pageerror", (error) => logs.push(`pageerror: ${error.message}`));
    const uploadRequests = [];
    page.on("request", (request) => {
      uploadRequests.push({ method: request.method(), url: request.url(), body: request.postData() ?? "" });
    });

    const setup = await page.evaluate(() => ({
      title: document.querySelector("h1")?.textContent?.trim(),
      noindex: document.querySelector('meta[name="robots"]')?.getAttribute("content")?.includes("noindex") ?? false,
      weekendOptions: [...document.querySelectorAll("select option")].map((option) => option.textContent?.trim()),
      hasStickyCreate: [...document.querySelectorAll("button")].some((button) => button.textContent?.trim() === "Create plan"),
    }));
    assert(setup.title === "SAT Study Plan Generator", "Public canonical heading changed");
    assert(!setup.noindex, "Public planner is unexpectedly noindex");
    assert(setup.weekendOptions.length > 0 && setup.weekendOptions.every((label) => label?.startsWith("Weekend SAT —")), "SAT dates are not labeled as weekend dates");
    assert(setup.weekendOptions.some((label) => label?.includes("June 5, 2027")), "June 2027 date is missing");

    const fileInput = await page.$('input[type="file"]');
    assert(fileInput, "Score-report file input is missing");
    await fileInput.uploadFile(artifacts.malformedFixture);
    await page.waitForFunction(() =>
      document.body.innerText.includes("This file cannot be applied")
      || document.body.innerText.includes("Could not import this report"), { timeout: 120_000 });
    const malformedReview = await page.evaluate(() => ({
      applyBlocked: (() => {
        const apply = [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Apply to plan");
        return !apply || apply.disabled;
      })(),
      rejected: document.body.innerText.includes("This file cannot be applied")
        || document.body.innerText.includes("Could not import this report"),
      stored: localStorage.getItem("1600now-study-plan:v2:anon"),
    }));
    assert(malformedReview.rejected && malformedReview.applyBlocked, "Malformed report can still be applied");
    assert(malformedReview.stored === null, "Malformed report data was persisted");
    const malformedA11y = await inspectA11y(page);
    assert(malformedA11y.length === 0, `Serious malformed-upload accessibility findings: ${JSON.stringify(malformedA11y)}`);
    if (await page.evaluate(() => [...document.querySelectorAll("button")].some((button) => button.textContent?.trim() === "Discard"))) {
      await clickExact(page, "Discard");
    }

    const validFileInput = await page.$('input[type="file"]');
    assert(validFileInput, "Score-report file input disappeared after rejecting a malformed file");
    await validFileInput.uploadFile(artifacts.fixture);
    await page.waitForFunction(() => document.body.innerText.includes("Review before applying"), { timeout: 120_000 });
    const sensitiveUploadRequests = uploadRequests.filter((request) => /study-plan-score-report-fixture|\.pdf|1230|\b620\b|\b610\b|information and ideas|%PDF/i.test(`${request.url} ${request.body}`));
    assert(sensitiveUploadRequests.length === 0, `Sensitive report content reached the network: ${JSON.stringify(sensitiveUploadRequests)}`);
    await page.screenshot({ path: artifacts.setup, fullPage: true });

    const review = await page.evaluate(() => ({
      text: document.body.innerText,
      reviewText: document.querySelector('[aria-label="Review imported score report"]')?.textContent ?? "",
      target: document.querySelector('input[aria-label="Target SAT score"]')?.value,
      storedBeforeApply: localStorage.getItem("1600now-study-plan:v2:anon"),
    }));
    assert(review.text.includes("1230") && review.text.includes("620") && review.text.includes("610"), "Report review is missing detected scores");
    assert(review.reviewText.includes("Detected weak domains")
      && /Band [1-7] of 7/.test(review.reviewText)
      && review.reviewText.includes("Proposed focus changes")
      && review.reviewText.includes("Add")
      && review.reviewText.includes("Remove"),
    "Report review does not disclose weak-domain bands and focus additions/removals");
    assert(review.target === "1450", "Report silently changed the target score");
    assert(review.storedBeforeApply === null, "Unapproved report data was persisted");
    const setupA11y = await inspectA11y(page);
    assert(setupA11y.length === 0, `Serious setup accessibility findings: ${JSON.stringify(setupA11y)}`);

    await clickExact(page, "Apply to plan");
    await page.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes("Tighten Math timing"));
      button?.click();
    });
    await clickExact(page, "Create plan");
    await page.waitForFunction(() => document.body.innerText.includes("Your SAT study plan"), { timeout: 60_000 });
    await page.waitForFunction((key) => Boolean(localStorage.getItem(key)), { timeout: 10_000 }, v2Key);
    await page.screenshot({ path: artifacts.dashboard });

    const dashboard = await page.evaluate((key) => {
      const documentValue = JSON.parse(localStorage.getItem(key));
      const tasks = documentValue.tasks;
      const plannerRect = document.querySelector("[data-study-plan-lab]")?.getBoundingClientRect();
      const sidebarRect = document.querySelector('aside[data-tour="sidebar"]')?.getBoundingClientRect();
      const dashboardCardRect = [...document.querySelectorAll("[data-study-plan-lab] header")]
        .find((element) => element.textContent?.includes("Your SAT study plan"))
        ?.getBoundingClientRect();
      const scheduleRect = [...document.querySelectorAll("[data-study-plan-lab] section")]
        .find((element) => element.querySelector("h2")?.textContent?.trim() === "Schedule")
        ?.getBoundingClientRect();
      return {
        documentValue,
        clearsDesktopSidebar: !sidebarRect || [plannerRect, dashboardCardRect, scheduleRect]
          .filter(Boolean)
          .every((rect) => rect.left >= sidebarRect.right - 1),
        hasNextAction: document.body.innerText.includes("Next assignment"),
        hasMonthContext: /July 2026|August 2026|September 2026|October 2026/.test(document.body.innerText),
        tasksReachable: tasks.every((task) => task.date >= documentValue.settings.startDate && task.date < documentValue.settings.satDate),
        tasksActionable: tasks.every((task) => Boolean(task.action)),
        tasksBudgeted: tasks.every((task) => task.minutes <= documentValue.settings.minutesPerDay && task.workMinutes + task.reviewMinutes === task.minutes),
        readingVocabularyFree: tasks.filter((task) => task.action.kind === "timed-set" && task.action.subject === "reading").every((task) => task.action.excludeSkills.includes("Words in Context")),
        modulesMathOnly: tasks.filter((task) => task.action.kind === "module").every((task) => task.action.subject === "math"),
        noSensitiveReportFields: !/fileName|extractedText|rawContext|Example Student/i.test(JSON.stringify(documentValue)),
      };
    }, v2Key);
    assert(dashboard.hasNextAction && dashboard.hasMonthContext, "Dashboard hierarchy or month context is missing");
    assert(dashboard.clearsDesktopSidebar, "Planner content is occluded by the desktop sidebar");
    assert(dashboard.tasksReachable && dashboard.tasksActionable && dashboard.tasksBudgeted, "Generated tasks failed reachability/action/budget checks");
    assert(dashboard.readingVocabularyFree && dashboard.modulesMathOnly, "Launched assignment rules failed vocabulary or subject checks");
    assert(dashboard.noSensitiveReportFields, "Sensitive report data was persisted");

    const editBaseline = await page.evaluate((key) => localStorage.getItem(key), v2Key);
    await clickExact(page, "Edit");
    await page.waitForFunction(() => document.body.innerText.includes("Back to plan"), { timeout: 20_000 });
    const editedTarget = await page.evaluate(() => {
      const input = document.querySelector('input[aria-label="Target SAT score"]');
      if (!(input instanceof HTMLInputElement)) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "1500");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    });
    assert(editedTarget, "Edit mode target score was not editable");
    await clickExact(page, "Back to plan");
    await page.waitForFunction(() => document.body.innerText.includes("Your SAT study plan"), { timeout: 20_000 });
    const editCancelled = await page.evaluate((key, baseline) => ({
      storageUnchanged: localStorage.getItem(key) === baseline,
      targetRestored: document.body.innerText.includes("1450 target"),
    }), v2Key, editBaseline);
    assert(editCancelled.storageUnchanged && editCancelled.targetRestored, "Back to plan committed an unsaved edit");

    const finalTask = dashboard.documentValue.tasks.at(-1);
    await page.evaluate(() => {
      const next = document.querySelector('button[aria-label^="Next month,"]');
      let remaining = 14;
      while (next && !next.disabled && remaining > 0) {
        next.click();
        remaining -= 1;
      }
    });
    await sleep(100);
    const finalReachable = await page.evaluate((date) => Boolean(document.querySelector(`button[aria-label^="${new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00`))}"]`)), finalTask.date);
    assert(finalReachable, "The final scheduled assignment is not reachable in month navigation");

    const controls = await inspectControls(page);
    assert(controls.unlabeledControls.length === 0, `Unlabeled controls: ${controls.unlabeledControls.join(" | ")}`);
    assert(controls.smallTargets.length === 0, `Touch targets below 44px: ${controls.smallTargets.join(" | ")}`);
    const dashboardA11y = await inspectA11y(page);
    assert(dashboardA11y.length === 0, `Serious dashboard accessibility findings: ${JSON.stringify(dashboardA11y)}`);

    const overdueTaskId = await page.evaluate((key, today) => {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      const task = value?.tasks?.[0];
      if (!task) return null;
      const date = new Date(`${today}T12:00:00`);
      date.setDate(date.getDate() - 1);
      task.date = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      delete value.progress[task.id];
      value.updatedAt = Date.now() + 1;
      localStorage.setItem(key, JSON.stringify(value));
      return task.id;
    }, v2Key, fixedToday);
    assert(overdueTaskId, "Could not prepare an overdue assignment for verification");
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForFunction(() => document.body.innerText.includes("Resolve overdue work"), { timeout: 20_000 });
    const overdueActions = await page.evaluate(() => {
      const heading = [...document.querySelectorAll("h2")].find((element) => element.textContent?.trim() === "Resolve overdue work");
      return [...(heading?.parentElement?.parentElement?.querySelectorAll("button") ?? [])]
        .map((button) => button.textContent?.trim())
        .filter(Boolean);
    });
    assert(["Keep", "Move forward", "Skip"].every((label) => overdueActions.includes(label)), `Overdue actions are incomplete: ${JSON.stringify(overdueActions)}`);
    await clickExact(page, "Skip");
    await page.waitForFunction((key, taskId) => {
      const record = JSON.parse(localStorage.getItem(key) || "null")?.progress?.[taskId];
      return record?.completed === true && record?.skipped === true;
    }, { timeout: 20_000 }, v2Key, overdueTaskId);

    await page.emulateMediaType("print");
    await page.screenshot({ path: artifacts.print, fullPage: true });
    const print = await page.evaluate(() => ({
      hasPlan: document.body.innerText.includes("Daily SAT Plan"),
      hasTasks: document.querySelectorAll("[data-print-plan] article").length > 0,
      navigationHidden: [...document.querySelectorAll("nav")].every((nav) => getComputedStyle(nav).display === "none"),
      publicHeadingHidden: [...document.querySelectorAll("h1")]
        .filter((heading) => heading.textContent?.trim() === "SAT Study Plan Generator")
        .every((heading) => heading.getClientRects().length === 0),
      faqHidden: [...document.querySelectorAll("h2")]
        .filter((heading) => heading.textContent?.trim() === "FAQs")
        .every((heading) => heading.getClientRects().length === 0),
      toastsHidden: [...document.querySelectorAll("[data-sonner-toaster]")]
        .every((toaster) => toaster.getClientRects().length === 0),
    }));
    assert(print.hasPlan && print.hasTasks && print.navigationHidden && print.publicHeadingHidden && print.faqHidden && print.toastsHidden, "Print output failed");
    await page.close();

    const mobileResults = [];
    for (const width of [320, 375, 390]) {
      const mobile = await openCleanPage(browser, { width, height: 844 });
      const before = await mobile.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        createVisible: [...document.querySelectorAll("button")].some((button) => button.textContent?.trim() === "Create plan" && getComputedStyle(button).display !== "none"),
      }));
      assert(!before.overflow && before.createVisible, `First-time setup failed at ${width}px`);
      if (width === 390) {
        let activated = false;
        for (let index = 0; index < 100; index += 1) {
          await mobile.keyboard.press("Tab");
          const activeText = await mobile.evaluate(() => document.activeElement?.textContent?.trim());
          if (activeText === "Create plan") {
            await mobile.keyboard.press("Enter");
            activated = true;
            break;
          }
        }
        assert(activated, "Create plan is not keyboard reachable");
        await mobile.waitForFunction(() => document.body.innerText.includes("Your SAT study plan"), { timeout: 60_000 });
        await mobile.waitForFunction((key) => Boolean(localStorage.getItem(key)), { timeout: 10_000 }, v2Key);
        const agenda = await mobile.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > window.innerWidth,
          agendaVisible: document.body.innerText.includes("Chronological agenda"),
          monthGridHidden: getComputedStyle(document.querySelector('button[aria-label^="Previous month,"]')?.closest(".md\\:block") ?? document.body).display === "none",
        }));
        assert(!agenda.overflow && agenda.agendaVisible && agenda.monthGridHidden, "Mobile dashboard agenda failed");
        const keyboardCheckbox = await mobile.$('[data-selected-assignment] [role="checkbox"]');
        assert(keyboardCheckbox, "Task completion checkbox is not keyboard reachable");
        await keyboardCheckbox.focus();
        await mobile.keyboard.press("Space");
        await mobile.waitForFunction(() =>
          document.querySelector('[data-selected-assignment] [role="checkbox"]')?.getAttribute("data-state") === "checked",
        { timeout: 20_000 });
        await mobile.keyboard.press("Space");
        await mobile.waitForFunction(() =>
          document.querySelector('[data-selected-assignment] [role="checkbox"]')?.getAttribute("data-state") === "unchecked",
        { timeout: 20_000 });
        await mobile.screenshot({ path: artifacts.mobile, fullPage: true });
      }
      mobileResults.push({ width, ...before });
      await mobile.close();
    }

    const launchPage = await browser.newPage();
    await installFixedClock(launchPage);
    await launchPage.goto(publicUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await launchPage.waitForFunction(() => document.body.innerText.includes("Your SAT study plan"), { timeout: 60_000 });
    const launchTaskId = await launchPage.evaluate((key) => {
      const documentValue = JSON.parse(localStorage.getItem(key));
      const targetIndex = documentValue.tasks.findIndex((task) => task.action.kind === "timed-set");
      if (targetIndex < 0) return null;
      for (const task of documentValue.tasks.slice(0, targetIndex)) {
        documentValue.progress[task.id] = { completed: true, completedAt: new Date().toISOString() };
      }
      documentValue.updatedAt = Date.now();
      localStorage.setItem(key, JSON.stringify(documentValue));
      return documentValue.tasks[targetIndex].id;
    }, v2Key);
    assert(launchTaskId, "No timed assignment was generated for launch verification");
    await launchPage.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
    await launchPage.waitForFunction(() => document.body.innerText.includes("Your SAT study plan"), { timeout: 60_000 });
    const focusedPrimaryCta = await launchPage.evaluate(() => {
      const nextHeading = [...document.querySelectorAll("div")].find((item) => item.textContent?.trim() === "Next assignment");
      const container = nextHeading?.parentElement;
      const button = container?.querySelector("button");
      if (!button || !/^Start \d+-question set$/.test(button.textContent?.trim() ?? "")) return false;
      button.focus();
      return true;
    });
    assert(focusedPrimaryCta, "Primary Next assignment CTA is not an executable one-click action");
    await launchPage.keyboard.press("Enter");
    await launchPage.waitForFunction(() => location.pathname.startsWith("/bank/"), { timeout: 60_000 });
    await launchPage.waitForFunction(() => document.body.innerText.includes("Return to study plan")
      || Boolean(document.querySelector('[aria-label="Return to study plan"]')), { timeout: 60_000 });
    const launch = await launchPage.evaluate(() => {
      const practiceSet = JSON.parse(sessionStorage.getItem("practiceSet") || "[]");
      return {
        path: location.pathname,
        returnPath: sessionStorage.getItem("practiceExitTo"),
        context: JSON.parse(sessionStorage.getItem("study-plan:assignment:v1") || "null"),
        hasReturnControl: document.body.innerText.includes("Return to study plan")
          || Boolean(document.querySelector('[aria-label="Return to study plan"]')),
        launchedVocabularyFree: practiceSet.every((question) => !/words in context|vocab/i.test(question.skill || "")),
        launchedDomainCount: new Set(practiceSet.map((question) => question.domain).filter(Boolean)).size,
      };
    });
    assert(launch.returnPath === "/sat-study-plan-generator", "Practice return path is wrong");
    assert(launch.context?.context?.timingMode?.kind === "countdown", "Custom assignment countdown was not created");
    assert(launch.context?.context?.assignmentId === launchTaskId, "Launched assignment context does not match the Next assignment task");
    assert(launch.hasReturnControl, "Practice route does not expose Return to study plan");
    assert(launch.launchedVocabularyFree, "The launched Reading & Writing set includes vocabulary questions");
    assert(launch.launchedDomainCount >= 4, "The no-report diagnostic did not launch a cross-domain set");
    const practiceA11y = await inspectA11y(launchPage, null);
    assert(practiceA11y.length === 0, `Serious practice-route accessibility findings: ${JSON.stringify(practiceA11y)}`);

    const focusedReturn = await launchPage.evaluate(() => {
      const control = [...document.querySelectorAll("button,a")].find((element) =>
        (element.textContent?.trim() === "Return to study plan"
          || element.getAttribute("aria-label") === "Return to study plan")
        && element.getClientRects().length > 0);
      control?.focus();
      return Boolean(control);
    });
    assert(focusedReturn, "Return to study plan is not keyboard reachable");
    await launchPage.keyboard.press("Enter");
    await launchPage.waitForFunction(() =>
      location.pathname === "/sat-study-plan-generator"
      || document.querySelector('[role="alertdialog"]')?.textContent?.includes("Return to your study plan?"),
    { timeout: 60_000 });
    const hasReturnConfirmation = await launchPage.evaluate(() =>
      Boolean(document.querySelector('[role="alertdialog"]')?.textContent?.includes("Return to your study plan?")));
    if (hasReturnConfirmation) {
      const returnDialogA11y = await inspectA11y(launchPage, '[role="alertdialog"]');
      assert(returnDialogA11y.length === 0, `Serious return-dialog accessibility findings: ${JSON.stringify(returnDialogA11y)}`);
      const focusedReturnConfirmation = await launchPage.evaluate(() => {
        const dialog = document.querySelector('[role="alertdialog"]');
        const control = [...(dialog?.querySelectorAll("button") ?? [])].find((element) =>
          element.textContent?.trim() === "Return to study plan" && element.getClientRects().length > 0);
        control?.focus();
        return Boolean(control);
      });
      assert(focusedReturnConfirmation, "Return confirmation is not keyboard reachable");
      await launchPage.keyboard.press("Enter");
    }
    await launchPage.waitForFunction(() => location.pathname === "/sat-study-plan-generator", { timeout: 60_000 });
    const pausedAfterExit = await launchPage.evaluate(() =>
      JSON.parse(sessionStorage.getItem("study-plan:assignment:v1") || "null")?.status === "paused");
    assert(pausedAfterExit, "Save/exit did not pause the planned assignment");
    const savedAssignmentSession = await launchPage.evaluate(() => {
      const raw = sessionStorage.getItem("study-plan:assignment:v1");
      const session = JSON.parse(raw || "null");
      session.context.timingMode.timeLimitSeconds += 60;
      sessionStorage.setItem("study-plan:assignment:v1", JSON.stringify(session));
      return raw;
    });
    assert(savedAssignmentSession, "Paused assignment session was not stored");
    const changedSettingsButton = await launchPage.evaluate(() => {
      const heading = [...document.querySelectorAll("div")].find((item) => item.textContent?.trim() === "Next assignment");
      const button = heading?.parentElement?.querySelector("button");
      button?.focus();
      return Boolean(button);
    });
    assert(changedSettingsButton, "Changed-settings assignment is not reachable");
    await launchPage.keyboard.press("Enter");
    await launchPage.waitForFunction(() => document.body.innerText.includes("Assignment settings changed"), { timeout: 20_000 });
    await launchPage.waitForFunction(() => {
      const dialog = document.querySelector('[role="alertdialog"]');
      return Boolean(dialog && dialog.getAnimations({ subtree: true }).every((animation) => animation.playState === "finished"));
    }, { timeout: 5_000 });
    const changedSettingsDialog = await launchPage.evaluate(() => ({
      resume: document.body.innerText.includes("Resume saved assignment"),
      restart: document.body.innerText.includes("Restart with current settings"),
    }));
    assert(changedSettingsDialog.resume && changedSettingsDialog.restart, "Changed assignment settings did not offer Resume and Restart");
    const changedSettingsA11y = await inspectA11y(launchPage, '[role="alertdialog"]');
    assert(changedSettingsA11y.length === 0, `Serious changed-settings dialog accessibility findings: ${JSON.stringify(changedSettingsA11y)}`);
    await clickExact(launchPage, "Keep paused");
    await launchPage.evaluate((raw) => sessionStorage.setItem("study-plan:assignment:v1", raw), savedAssignmentSession);
    const savedPracticeSet = await launchPage.evaluate(() => {
      const value = sessionStorage.getItem("practiceSet");
      sessionStorage.setItem("practiceSet", "[]");
      return value;
    });
    assert(savedPracticeSet, "Launched practice set was not stored for resume verification");
    let staleResumePrompt = "";
    launchPage.once("dialog", async (dialog) => {
      staleResumePrompt = dialog.message();
      await dialog.dismiss();
    });
    const staleResumeButton = await launchPage.evaluate(() => {
      const heading = [...document.querySelectorAll("div")].find((item) => item.textContent?.trim() === "Next assignment");
      const button = heading?.parentElement?.querySelector("button");
      button?.focus();
      return Boolean(button);
    });
    assert(staleResumeButton, "Stale saved assignment is not reachable from the planner");
    await launchPage.keyboard.press("Enter");
    await launchPage.waitForFunction(() => !document.body.innerText.includes("Starting…"), { timeout: 20_000 });
    const staleSessionKept = await launchPage.evaluate((practiceRunId, practiceSet) => {
      const session = JSON.parse(sessionStorage.getItem("study-plan:assignment:v1") || "null");
      sessionStorage.setItem("practiceSet", practiceSet);
      return session?.status === "paused"
        && session?.context?.source?.practiceRunId === practiceRunId;
    }, launch.context.context.source.practiceRunId, savedPracticeSet);
    assert(staleResumePrompt.includes("Restart it with a fresh full timer") && staleSessionKept,
      "A stale practice set was reset without confirmation");
    const focusedResume = await launchPage.evaluate(() => {
      const heading = [...document.querySelectorAll("div")].find((item) => item.textContent?.trim() === "Next assignment");
      const button = heading?.parentElement?.querySelector("button");
      button?.focus();
      return Boolean(button);
    });
    assert(focusedResume, "Paused assignment is not keyboard resumable from the planner");
    await launchPage.keyboard.press("Enter");
    await launchPage.waitForFunction(() => location.pathname.startsWith("/bank/"), { timeout: 60_000 });
    const resumedAfterExit = await launchPage.evaluate((practiceRunId) => {
      const session = JSON.parse(sessionStorage.getItem("study-plan:assignment:v1") || "null");
      return session?.status === "active"
        && session?.context?.source?.practiceRunId === practiceRunId;
    }, launch.context.context.source.practiceRunId);
    assert(resumedAfterExit, "The planner did not resume the same saved assignment session");

    await Promise.all([
      launchPage.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 60_000 }),
      launchPage.evaluate(() => {
        const session = JSON.parse(sessionStorage.getItem("study-plan:assignment:v1"));
        const context = session.context;
        const missedQuestion = context.source.questionRefs[0];
        session.status = "completed";
        sessionStorage.setItem("study-plan:assignment:v1", JSON.stringify(session));
        sessionStorage.setItem("study-plan:assignment-result:v1", JSON.stringify({
          version: 1,
          ownerUid: context.ownerUid,
          assignmentId: context.assignmentId,
          plannedDate: context.plannedDate,
          returnPath: context.returnPath,
          source: context.source,
          sourceSessionId: context.source.practiceRunId,
          completedAt: Date.now(),
          elapsedSeconds: 60,
          questionCount: 1,
          attemptedCount: 1,
          correctCount: 0,
          accuracy: 0,
          missedQuestionIds: [missedQuestion.storageId],
          missedSkills: ["Math module timing"],
          questionResults: [{
            storageId: missedQuestion.storageId,
            sourceId: missedQuestion.sourceId,
            subject: missedQuestion.subject,
            bankType: missedQuestion.bankType,
            skill: "Math module timing",
            attemptCount: 1,
            firstAttemptCorrect: false,
            isCorrect: false,
            timeSpentSeconds: 60,
          }],
        }));
        location.assign(context.returnPath);
      }),
    ]);
    await launchPage.waitForFunction(() => document.body.innerText.includes("Your SAT study plan"), { timeout: 60_000 });
    await sleep(1_000);
    const completionState = await launchPage.evaluate((key, taskId) => {
      const proposal = [...document.querySelectorAll("div")].find((element) => element.textContent?.trim() === "Proposed rebalance");
      return {
        proposed: Boolean(proposal && proposal.getClientRects().length > 0),
        proposalExists: Boolean(proposal),
        proposalDisplay: proposal ? getComputedStyle(proposal).display : null,
        pendingAttribute: document.querySelector("[data-study-plan-lab]")?.getAttribute("data-rebalance-pending"),
        storedResult: sessionStorage.getItem("study-plan:assignment-result:v1"),
        storedSession: sessionStorage.getItem("study-plan:assignment:v1"),
        progress: JSON.parse(localStorage.getItem(key) || "null")?.progress?.[taskId] ?? null,
        task: JSON.parse(localStorage.getItem(key) || "null")?.tasks?.find((candidate) => candidate.id === taskId) ?? null,
      };
    }, v2Key, launchTaskId);
    assert(completionState.proposed, `Completed practice did not propose a rebalance: ${JSON.stringify(completionState)}`);
    await launchPage.waitForFunction((key, taskId) => {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value?.progress?.[taskId]?.completed === true;
    }, { timeout: 20_000 }, v2Key, launchTaskId);
    await clickExact(launchPage, "Apply proposal");
    await launchPage.waitForFunction(() => !document.body.innerText.includes("Proposed rebalance"), { timeout: 20_000 });
    await launchPage.waitForFunction((key, taskId, today) => {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      const task = value?.tasks?.find((candidate) => candidate.id === taskId);
      const review = value?.tasks?.find((candidate) => candidate.id === `${taskId}-missed-review`);
      const reviewDayMinutes = value?.tasks
        ?.filter((candidate) => candidate.date === review?.date)
        .reduce((sum, candidate) => sum + candidate.minutes, 0);
      const daysUntilTest = review
        ? Math.round((new Date(`${value.settings.satDate}T12:00:00`) - new Date(`${review.date}T12:00:00`)) / 86_400_000)
        : 0;
      const taperStayedLight = value?.tasks
        ?.filter((candidate) => {
          const days = Math.round((new Date(`${value.settings.satDate}T12:00:00`) - new Date(`${candidate.date}T12:00:00`)) / 86_400_000);
          return days > 0 && days <= 6;
        })
        .every((candidate) => candidate.action?.kind === "checklist" && candidate.minutes <= 20);
      return value?.settings?.intensity?.Pacing === "heavy"
        && task?.locked === true
        && value?.progress?.[taskId]?.rebalanceDecision === "applied"
        && review?.action?.kind === "missed-review"
        && review.action.questionRefs?.length === 1
        && review.date > today
        && daysUntilTest > 6
        && taperStayedLight
        && reviewDayMinutes <= value.settings.minutesPerDay;
    }, { timeout: 20_000 }, v2Key, launchTaskId, fixedToday);

    const cancelRebalance = await launchPage.evaluate((key, firstTaskId) => {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      const task = value?.tasks?.find((candidate) =>
        candidate.id !== firstTaskId
        && candidate.action?.kind === "timed-set"
        && candidate.focus !== "Pacing"
        && !value.progress?.[candidate.id]?.completed);
      if (!task) return null;
      const originalIntensity = value.settings.intensity[task.focus];
      value.progress[task.id] = {
        completed: true,
        completedAt: new Date().toISOString(),
        accuracy: 0,
        elapsedSeconds: 60,
        missedSkills: [],
        missedQuestionRefs: [],
      };
      value.updatedAt = Date.now() + 1;
      localStorage.setItem(key, JSON.stringify(value));
      return { taskId: task.id, focus: task.focus, originalIntensity };
    }, v2Key, launchTaskId);
    assert(cancelRebalance, "No second timed assignment was available for rebalance-cancel verification");
    await launchPage.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
    await launchPage.waitForFunction(() => document.body.innerText.includes("Your SAT study plan"), { timeout: 20_000 });
    await launchPage.waitForFunction(() =>
      document.querySelector("[data-study-plan-lab]")?.getAttribute("data-rebalance-pending") === "true", { timeout: 20_000 });
    await clickExact(launchPage, "Keep current plan");
    await launchPage.waitForFunction((key, taskId, focus, originalIntensity) => {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value?.progress?.[taskId]?.rebalanceDecision === "kept"
        && value?.settings?.intensity?.[focus] === originalIntensity;
    }, { timeout: 20_000 }, v2Key, cancelRebalance.taskId, cancelRebalance.focus, cancelRebalance.originalIntensity);

    const noOpRebalanceTaskId = await launchPage.evaluate((key) => {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      const task = value?.tasks?.find((candidate) =>
        candidate.focus === "Pacing"
        && !value.progress?.[candidate.id]?.completed);
      if (!task || value.settings.intensity.Pacing !== "heavy") return null;
      value.progress[task.id] = {
        completed: true,
        completedAt: new Date().toISOString(),
        accuracy: 0,
        elapsedSeconds: 60,
        missedSkills: ["Math module timing"],
        missedQuestionRefs: [],
      };
      value.updatedAt = Date.now() + 2;
      localStorage.setItem(key, JSON.stringify(value));
      return task.id;
    }, v2Key);
    assert(noOpRebalanceTaskId, "No Pacing task was available for no-op rebalance verification");
    await launchPage.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
    await launchPage.waitForFunction(() => document.body.innerText.includes("Your SAT study plan"), { timeout: 20_000 });
    await sleep(300);
    const noOpRebalanceHidden = await launchPage.evaluate(() =>
      document.querySelector("[data-study-plan-lab]")?.getAttribute("data-rebalance-pending") !== "true"
      && !document.body.innerText.includes("Proposed rebalance"));
    assert(noOpRebalanceHidden, "A no-op rebalance was presented as an actionable change");
    await launchPage.evaluate((key, taskId) => {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      delete value.progress[taskId];
      value.updatedAt = Date.now() + 3;
      localStorage.setItem(key, JSON.stringify(value));
    }, v2Key, noOpRebalanceTaskId);
    await launchPage.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
    await launchPage.waitForFunction(() => document.body.innerText.includes("Your SAT study plan"), { timeout: 20_000 });

    const moduleTarget = await launchPage.evaluate((key) => {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      const targetIndex = value?.tasks?.findIndex((task) => task.action?.kind === "module") ?? -1;
      if (targetIndex < 0) return null;
      for (const task of value.tasks.slice(0, targetIndex)) {
        value.progress[task.id] = {
          ...value.progress[task.id],
          completed: true,
          completedAt: new Date().toISOString(),
        };
      }
      const target = value.tasks[targetIndex];
      delete value.progress[target.id];
      value.updatedAt = Date.now() + 2;
      localStorage.setItem(key, JSON.stringify(value));
      return {
        taskId: target.id,
        moduleSlug: target.action.moduleSlug,
        timeLimitSeconds: target.action.timeLimitMinutes * 60,
      };
    }, v2Key);
    assert(moduleTarget, "No Math module was available for resume/restart verification");
    await launchPage.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
    await launchPage.waitForFunction((taskId) =>
      document.body.innerText.includes("Your SAT study plan")
      && document.body.innerText.includes("Start timed Math module")
      && JSON.parse(localStorage.getItem("1600now-study-plan:v2:anon") || "null")?.progress?.[taskId]?.completed !== true,
    { timeout: 20_000 }, moduleTarget.taskId);
    await clickExact(launchPage, "Start timed Math module");
    await launchPage.waitForFunction(() => location.pathname.startsWith("/bank/"), { timeout: 60_000 });
    const initialModuleLaunch = await launchPage.evaluate((slug) => {
      const assignment = JSON.parse(sessionStorage.getItem("study-plan:assignment:v1") || "null");
      const moduleKey = Object.keys(sessionStorage).find((key) =>
        key.startsWith("module-practice:session:v1:anon:")
        && JSON.parse(sessionStorage.getItem(key) || "null")?.moduleSlug === slug);
      return {
        assignment,
        moduleKey,
        moduleSession: moduleKey ? JSON.parse(sessionStorage.getItem(moduleKey) || "null") : null,
      };
    }, moduleTarget.moduleSlug);
    assert(initialModuleLaunch.assignment?.context?.assignmentId === moduleTarget.taskId, "Math module was not bound to the planned assignment");
    assert(initialModuleLaunch.moduleKey, "Owner-scoped Math module session was not saved");
    assert(initialModuleLaunch.assignment?.context?.timingMode?.timeLimitSeconds === moduleTarget.timeLimitSeconds, "Math module assignment timer is wrong");
    assert(initialModuleLaunch.moduleSession?.settings?.timed === true
      && initialModuleLaunch.moduleSession?.settings?.timeLimitSeconds === moduleTarget.timeLimitSeconds
      && initialModuleLaunch.moduleSession?.settings?.allowCheckingAnswers === false,
    "Math module session settings do not match the assignment");

    await clickExact(launchPage, "Return to study plan");
    await launchPage.waitForFunction(() => location.pathname === "/sat-study-plan-generator"
      || Boolean(document.querySelector('[role="alertdialog"]')), { timeout: 20_000 });
    if (await launchPage.$('[role="alertdialog"]')) {
      const confirmedReturn = await launchPage.evaluate(() => {
        const dialog = document.querySelector('[role="alertdialog"]');
        const button = [...(dialog?.querySelectorAll("button") ?? [])].find((item) =>
          item.textContent?.trim() === "Return to study plan");
        button?.click();
        return Boolean(button);
      });
      assert(confirmedReturn, "Module return confirmation action was not available");
    }
    await launchPage.waitForFunction(() => location.pathname === "/sat-study-plan-generator", { timeout: 60_000 });
    const pausedForReturn = await launchPage.evaluate((moduleKey) => ({
      moduleStatus: JSON.parse(sessionStorage.getItem(moduleKey) || "null")?.status,
      assignmentStatus: JSON.parse(sessionStorage.getItem("study-plan:assignment:v1") || "null")?.status,
    }), initialModuleLaunch.moduleKey);
    assert(pausedForReturn.moduleStatus === "paused" && pausedForReturn.assignmentStatus === "paused",
      `Returning to the plan did not pause the module: ${JSON.stringify(pausedForReturn)}`);
    await launchPage.goBack({ waitUntil: "domcontentloaded", timeout: 60_000 });
    await launchPage.waitForFunction((moduleKey) => {
      const moduleSession = JSON.parse(sessionStorage.getItem(moduleKey) || "null");
      const assignment = JSON.parse(sessionStorage.getItem("study-plan:assignment:v1") || "null");
      return location.pathname.startsWith("/bank/")
        && moduleSession?.status === "active"
        && assignment?.status === "active";
    }, { timeout: 20_000 }, initialModuleLaunch.moduleKey);
    const remainingBeforeBackAdvance = await launchPage.evaluate((moduleKey) =>
      JSON.parse(sessionStorage.getItem(moduleKey) || "null")?.remainingSeconds,
    initialModuleLaunch.moduleKey);
    await launchPage.evaluate(() => {
      const BaseDate = Date;
      const advancedTimestamp = BaseDate.now() + 1_500;
      class AdvancedDate extends BaseDate {
        constructor(...args) {
          super(...(args.length ? args : [advancedTimestamp]));
        }
        static now() { return advancedTimestamp; }
      }
      window.Date = AdvancedDate;
    });
    await launchPage.waitForFunction((moduleKey, previousRemaining) =>
      JSON.parse(sessionStorage.getItem(moduleKey) || "null")?.remainingSeconds < previousRemaining,
    { timeout: 20_000 }, initialModuleLaunch.moduleKey, remainingBeforeBackAdvance);
    const browserBackResumedTimer = await launchPage.evaluate((moduleKey) => ({
      status: JSON.parse(sessionStorage.getItem(moduleKey) || "null")?.status,
      remainingSeconds: JSON.parse(sessionStorage.getItem(moduleKey) || "null")?.remainingSeconds,
    }), initialModuleLaunch.moduleKey);

    await launchPage.goto(publicUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await launchPage.waitForFunction(() => document.body.innerText.includes("Start timed Math module"), { timeout: 20_000 });
    await clickExact(launchPage, "Start timed Math module");
    await launchPage.waitForFunction(() => document.body.innerText.includes("Module already in progress"), { timeout: 20_000 });
    const matchingConflict = await launchPage.evaluate(() =>
      document.body.innerText.includes("Resume the matching timed module where you stopped"));
    assert(matchingConflict, "Matching module session was not offered Resume or Restart");
    await clickExact(launchPage, "Cancel");

    await launchPage.evaluate((moduleKey) => {
      const session = JSON.parse(sessionStorage.getItem(moduleKey));
      session.status = "paused";
      session.settings = { timed: false, timeLimitSeconds: null, allowCheckingAnswers: true };
      sessionStorage.setItem(moduleKey, JSON.stringify(session));
      sessionStorage.removeItem("study-plan:assignment:v1");
    }, initialModuleLaunch.moduleKey);
    await clickExact(launchPage, "Start timed Math module");
    await launchPage.waitForFunction(() =>
      document.body.innerText.includes("without counting it toward this assignment"), { timeout: 20_000 });
    await launchPage.waitForFunction(() => {
      const dialog = document.querySelector('[role="alertdialog"]');
      return Boolean(dialog && dialog.getAnimations({ subtree: true }).every((animation) => animation.playState === "finished"));
    }, { timeout: 5_000 });
    const moduleDialogA11y = await inspectA11y(launchPage, '[role="alertdialog"]');
    assert(moduleDialogA11y.length === 0, `Serious module-conflict accessibility findings: ${JSON.stringify(moduleDialogA11y)}`);
    await clickExact(launchPage, "Resume");
    await launchPage.waitForFunction(() => location.pathname.startsWith("/bank/"), { timeout: 60_000 });
    const mismatchedResumeUnbound = await launchPage.evaluate(() =>
      sessionStorage.getItem("study-plan:assignment:v1") === null);
    assert(mismatchedResumeUnbound, "A mismatched untimed module was incorrectly bound to the timed assignment");

    await launchPage.goto(publicUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await launchPage.waitForFunction(() => document.body.innerText.includes("Start timed Math module"), { timeout: 20_000 });
    await clickExact(launchPage, "Start timed Math module");
    await launchPage.waitForFunction(() =>
      document.body.innerText.includes("without counting it toward this assignment"), { timeout: 20_000 });
    await clickExact(launchPage, "Restart module");
    await launchPage.waitForFunction(() => location.pathname.startsWith("/bank/"), { timeout: 60_000 });
    const restartedModule = await launchPage.evaluate((slug) => {
      const assignment = JSON.parse(sessionStorage.getItem("study-plan:assignment:v1") || "null");
      const moduleKey = Object.keys(sessionStorage).find((key) =>
        key.startsWith("module-practice:session:v1:anon:")
        && JSON.parse(sessionStorage.getItem(key) || "null")?.moduleSlug === slug);
      return {
        assignment,
        moduleSession: moduleKey ? JSON.parse(sessionStorage.getItem(moduleKey) || "null") : null,
      };
    }, moduleTarget.moduleSlug);
    const moduleFlow = {
      matchingConflict,
      mismatchedResumeUnbound,
      browserBackResumedTimer,
      restartedBound: restartedModule.assignment?.context?.assignmentId === moduleTarget.taskId,
      restartedTimer: restartedModule.assignment?.context?.timingMode?.timeLimitSeconds,
      restartedSettings: restartedModule.moduleSession?.settings,
    };
    assert(moduleFlow.restartedBound
      && moduleFlow.browserBackResumedTimer.status === "active"
      && moduleFlow.browserBackResumedTimer.remainingSeconds < remainingBeforeBackAdvance
      && moduleFlow.restartedTimer === moduleTarget.timeLimitSeconds
      && moduleFlow.restartedSettings?.timed === true
      && moduleFlow.restartedSettings?.timeLimitSeconds === moduleTarget.timeLimitSeconds
      && moduleFlow.restartedSettings?.allowCheckingAnswers === false,
    `Restarted Math module did not use the assigned settings: ${JSON.stringify(moduleFlow)}`);
    const restartedSessionId = restartedModule.moduleSession?.sessionId;
    assert(restartedSessionId, "Restarted Math module session ID is missing");
    await launchPage.goto(`${baseUrl}/modules/${moduleTarget.moduleSlug}/review?session=${encodeURIComponent(restartedSessionId)}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await launchPage.waitForFunction(() => document.body.innerText.includes("Review Questions"), { timeout: 60_000 });
    await launchPage.evaluate((timeLimitSeconds) => {
      const BaseDate = Date;
      const advancedTimestamp = BaseDate.now() + (timeLimitSeconds + 1) * 1000;
      class AdvancedDate extends BaseDate {
        constructor(...args) {
          super(...(args.length ? args : [advancedTimestamp]));
        }
        static now() { return advancedTimestamp; }
      }
      window.Date = AdvancedDate;
    }, moduleTarget.timeLimitSeconds);
    await launchPage.waitForFunction(() => document.body.innerText.includes("Time has expired. Submit now"), { timeout: 20_000 });
    const expiredModuleReview = await launchPage.evaluate((moduleKey) => {
      const moduleSession = JSON.parse(sessionStorage.getItem(moduleKey) || "null");
      const dialog = document.querySelector('[role="alertdialog"]');
      const questionButtons = [...document.querySelectorAll("button")].filter((button) => /^\d+$/.test(button.textContent?.trim() ?? ""));
      return {
        elapsedSeconds: moduleSession?.elapsedSeconds,
        remainingSeconds: moduleSession?.remainingSeconds,
        hasSubmit: dialog?.textContent?.includes("Submit module") ?? false,
        hasContinue: dialog?.textContent?.includes("Keep reviewing") ?? false,
        questionEditingLocked: questionButtons.length > 0 && questionButtons.every((button) => button.disabled),
      };
    }, initialModuleLaunch.moduleKey);
    assert(expiredModuleReview.elapsedSeconds === moduleTarget.timeLimitSeconds
      && expiredModuleReview.remainingSeconds === 0
      && expiredModuleReview.hasSubmit
      && !expiredModuleReview.hasContinue
      && expiredModuleReview.questionEditingLocked,
    `Planner module expiry was not continuously enforced: ${JSON.stringify(expiredModuleReview)}`);
    const expiredModuleA11y = await inspectA11y(launchPage, '[role="alertdialog"]');
    assert(expiredModuleA11y.length === 0, `Serious expired-module accessibility findings: ${JSON.stringify(expiredModuleA11y)}`);
    await clickExact(launchPage, "Submit module");
    await launchPage.waitForFunction(() => location.pathname.endsWith("/results"), { timeout: 60_000 });
    await launchPage.waitForFunction(() => document.body.innerText.includes("Return to study plan"), { timeout: 60_000 });
    const moduleResult = await launchPage.evaluate((moduleKey, taskId, expectedElapsed) => {
      const assignmentResult = JSON.parse(sessionStorage.getItem("study-plan:assignment-result:v1") || "null");
      return {
        assignmentId: assignmentResult?.assignmentId,
        elapsedSeconds: assignmentResult?.elapsedSeconds,
        moduleSessionCleared: sessionStorage.getItem(moduleKey) === null,
        matches: assignmentResult?.assignmentId === taskId
          && assignmentResult?.elapsedSeconds === expectedElapsed,
      };
    }, initialModuleLaunch.moduleKey, moduleTarget.taskId, moduleTarget.timeLimitSeconds);
    assert(moduleResult.matches && moduleResult.moduleSessionCleared,
      `Planner module result did not preserve truthful elapsed time: ${JSON.stringify(moduleResult)}`);
    const returnedFromModuleResults = await launchPage.evaluate(() => {
      const link = [...document.querySelectorAll("a")].find((item) =>
        item.textContent?.trim().startsWith("Return to study plan") && item.getClientRects().length > 0);
      link?.click();
      return Boolean(link);
    });
    assert(returnedFromModuleResults, "Module results did not offer Return to study plan");
    await launchPage.waitForFunction(() => location.pathname === "/sat-study-plan-generator", { timeout: 60_000 });
    await launchPage.waitForFunction((key, taskId, expectedElapsed) => {
      const record = JSON.parse(localStorage.getItem(key) || "null")?.progress?.[taskId];
      return record?.completed === true && record?.elapsedSeconds === expectedElapsed;
    }, { timeout: 20_000 }, v2Key, moduleTarget.taskId, moduleTarget.timeLimitSeconds);
    const moduleCompletion = await launchPage.evaluate((key, taskId) => ({
      expiredReview: true,
      resultMatched: true,
      progress: JSON.parse(localStorage.getItem(key) || "null")?.progress?.[taskId] ?? null,
    }), v2Key, moduleTarget.taskId);
    await launchPage.close();

    const corruptStoragePage = await browser.newPage();
    await installFixedClock(corruptStoragePage);
    await corruptStoragePage.goto(publicUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await corruptStoragePage.evaluate((key) => localStorage.setItem(key, "{not-json"), v2Key);
    await corruptStoragePage.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
    await corruptStoragePage.waitForSelector("[data-study-plan-lab]", { timeout: 60_000 });
    await corruptStoragePage.waitForSelector('input[type="file"]', { timeout: 60_000 });
    const corruptStorageRecovered = await corruptStoragePage.evaluate(() =>
      document.body.innerText.includes("Build your SAT study plan")
      && document.body.innerText.includes("Create plan"));
    assert(corruptStorageRecovered, "Corrupted V2 storage did not recover to first-time setup");
    await clearPlannerState(corruptStoragePage);
    await corruptStoragePage.close();

    const claimedSourcePage = await openCleanPage(browser);
    const claimedSource = JSON.stringify(dashboard.documentValue);
    await claimedSourcePage.evaluate((key, source) => {
      localStorage.setItem(key, source);
    }, v2Key, claimedSource);
    await claimedSourcePage.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
    await claimedSourcePage.waitForFunction(() => document.body.innerText.includes("Your SAT study plan"), { timeout: 60_000 });
    await claimedSourcePage.evaluate((claimKey) => {
      localStorage.setItem(claimKey, JSON.stringify({
        uid: "claimed-user",
        claimedAt: Date.now(),
      }));
    }, anonymousClaimKey);
    let claimedDeletePrompt = "";
    claimedSourcePage.once("dialog", async (dialog) => {
      claimedDeletePrompt = dialog.message();
      await dialog.accept();
    });
    await clickExact(claimedSourcePage, "Start over");
    await claimedSourcePage.waitForFunction(() => document.body.innerText.includes("Plan data could not be deleted"), { timeout: 20_000 });
    const claimedSourceDeleteFailure = await claimedSourcePage.evaluate((key, claimKey, source) => ({
      stayedOnDashboard: document.body.innerText.includes("Your SAT study plan"),
      failureVisible: document.body.innerText.includes("Your existing plan is still shown so you can retry"),
      sourcePreserved: localStorage.getItem(key) === source,
      claimPreserved: JSON.parse(localStorage.getItem(claimKey) || "null")?.uid === "claimed-user",
    }), v2Key, anonymousClaimKey, claimedSource);
    assert(claimedDeletePrompt.includes("permanently delete")
      && Object.values(claimedSourceDeleteFailure).every(Boolean),
    `Claimed anonymous source produced a false delete success: ${JSON.stringify(claimedSourceDeleteFailure)}`);
    await clickExact(claimedSourcePage, "Edit");
    await claimedSourcePage.waitForFunction(() => document.body.innerText.includes("Back to plan"), { timeout: 20_000 });
    await clickExact(claimedSourcePage, "Save schedule");
    await claimedSourcePage.waitForFunction(() => document.body.innerText.includes("Plan not saved"), { timeout: 20_000 });
    const claimedSourceSaveFailure = await claimedSourcePage.evaluate((key, claimKey, source) => ({
      stayedInSetup: document.body.innerText.includes("Build your SAT study plan")
        && !document.body.innerText.includes("Your SAT study plan"),
      retryVisible: [...document.querySelectorAll("button")].some((button) =>
        button.textContent?.trim() === "Retry save" && button.getClientRects().length > 0),
      successNotShown: !document.body.innerText.includes("Study schedule saved"),
      sourcePreserved: localStorage.getItem(key) === source,
      claimPreserved: JSON.parse(localStorage.getItem(claimKey) || "null")?.uid === "claimed-user",
    }), v2Key, anonymousClaimKey, claimedSource);
    assert(Object.values(claimedSourceSaveFailure).every(Boolean),
      `Claimed anonymous source produced a false save success: ${JSON.stringify(claimedSourceSaveFailure)}`);
    const claimedSourceErrorA11y = await inspectA11y(claimedSourcePage);
    assert(claimedSourceErrorA11y.length === 0,
      `Serious claimed-source save-error accessibility findings: ${JSON.stringify(claimedSourceErrorA11y)}`);
    await claimedSourcePage.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
    await claimedSourcePage.waitForSelector('input[type="file"]', { timeout: 60_000 });
    const claimedSourceReloadPrivacy = await claimedSourcePage.evaluate((key, claimKey, source) => ({
      sourcePreserved: localStorage.getItem(key) === source,
      claimPreserved: JSON.parse(localStorage.getItem(claimKey) || "null")?.uid === "claimed-user",
      sourceHidden: document.body.innerText.includes("Build your SAT study plan")
        && !document.body.innerText.includes("Your SAT study plan"),
    }), v2Key, anonymousClaimKey, claimedSource);
    assert(Object.values(claimedSourceReloadPrivacy).every(Boolean),
      `Claimed anonymous source leaked after reload: ${JSON.stringify(claimedSourceReloadPrivacy)}`);
    await clearPlannerState(claimedSourcePage);
    await claimedSourcePage.close();

    const redirectPage = await browser.newPage();
    await redirectPage.goto(legacyUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await redirectPage.waitForFunction(() => location.pathname === "/sat-study-plan-generator", { timeout: 20_000 });
    await redirectPage.close();

    const imageUploadPage = await openCleanPage(browser);
    const imageUploadRequests = [];
    imageUploadPage.on("request", (request) => {
      imageUploadRequests.push({ method: request.method(), url: request.url(), body: request.postData() ?? "" });
    });
    const imageFileInput = await imageUploadPage.$('input[type="file"]');
    assert(imageFileInput, "Score-report image input is missing");
    await imageFileInput.uploadFile(artifacts.imageFixture);
    await imageUploadPage.waitForFunction(() => document.body.innerText.includes("Review before applying"), { timeout: 120_000 });
    const imageUpload = await imageUploadPage.evaluate(() => ({
      detected: document.body.innerText.includes("1230")
        && document.body.innerText.includes("620")
        && document.body.innerText.includes("610"),
      storedBeforeApply: localStorage.getItem("1600now-study-plan:v2:anon"),
    }));
    const sensitiveImageUploadRequests = imageUploadRequests.filter((request) =>
      /study-plan-score-report-fixture|1230|\b620\b|\b610\b|information and ideas/i.test(`${request.url} ${request.body}`));
    assert(imageUpload.detected, "Sanitized score-report image fixture was not parsed correctly");
    assert(imageUpload.storedBeforeApply === null, "Unapproved image report data was persisted");
    assert(sensitiveImageUploadRequests.length === 0, `Sensitive image report content reached the network: ${JSON.stringify(sensitiveImageUploadRequests)}`);
    await clickExact(imageUploadPage, "Apply to plan");
    await clickExact(imageUploadPage, "Create plan");
    await imageUploadPage.waitForFunction((key) => Boolean(localStorage.getItem(key)), { timeout: 20_000 }, v2Key);
    let deletionPrompt = "";
    imageUploadPage.once("dialog", async (dialog) => {
      deletionPrompt = dialog.message();
      await dialog.accept();
    });
    await clickExact(imageUploadPage, "Start over");
    await imageUploadPage.waitForFunction((key) =>
      localStorage.getItem(key) === null
      && document.body.innerText.includes("Build your SAT study plan"), { timeout: 20_000 }, v2Key);
    const startOverDeleted = deletionPrompt.includes("imported score summary")
      && deletionPrompt.includes("local plan backups");
    assert(startOverDeleted, `Start-over deletion scope was incomplete: ${deletionPrompt}`);
    await imageUploadPage.close();

    const result = { ok: true, fixedToday, setup, dashboard: { ...dashboard, documentValue: undefined }, controls, accessibility: { malformedA11y, setupA11y, dashboardA11y, practiceA11y, changedSettingsA11y, moduleDialogA11y, expiredModuleA11y, claimedSourceErrorA11y }, print, mobileResults, launch, overdueActions, editCancelled, noOpRebalanceHidden, cancelRebalance, moduleFlow, moduleCompletion, corruptStorageRecovered, claimedSourceDeleteFailure, claimedSourceSaveFailure, claimedSourceReloadPrivacy, imageUpload, startOverDeleted, logs, artifacts };
    await writeFile(artifacts.result, JSON.stringify(result, null, 2));
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
