import process from "node:process";

import puppeteer from "puppeteer";

const baseUrl = process.env.AUDIT_VERIFY_URL ?? "http://127.0.0.1:8080";
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
const analyticsRequests = [];
const consoleErrors = [];
page.on("request", (request) => {
  if (/googletagmanager|google-analytics|\/g\/collect/.test(request.url())) {
    analyticsRequests.push(request.url());
  }
});
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});

try {
  await page.setViewport({ width: 375, height: 667, isMobile: true, hasTouch: true });
  await page.goto(`${baseUrl}/bank/math/637563ef?bankType=past`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForSelector('[data-tour="desmos-button"]', { timeout: 60_000 });
  const desmosButtonLabel = await page.$eval(
    '[data-tour="desmos-button"]',
    (button) => button.getAttribute("aria-label"),
  );
  assert(desmosButtonLabel === "Desmos calculator", "Compressed Desmos trigger is unnamed");
  await page.click('[data-tour="desmos-button"]');
  await page.waitForSelector('[data-window-id="desmos"]', { timeout: 20_000 });
  const mobileWindow = await page.$eval('[data-window-id="desmos"]', (element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      width: rect.width,
      viewportWidth: window.innerWidth,
      split: document.documentElement.style.getPropertyValue("--sat-split-pct"),
    };
  });
  assert(
    mobileWindow.width >= mobileWindow.viewportWidth - 32,
    `Mobile Desmos width is ${mobileWindow.width}px in ${mobileWindow.viewportWidth}px viewport`,
  );
  assert(mobileWindow.left <= 16, `Mobile Desmos starts at ${mobileWindow.left}px`);
  assert(mobileWindow.split === "", "Mobile Desmos still reserves a split-screen column");

  await page.setViewport({ width: 1280, height: 1200, isMobile: false, hasTouch: true });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector('[data-tour="desmos-button"]', { timeout: 60_000 });
  await page.waitForFunction(
    () => document.documentElement.classList.contains("question-page-scroll-locked"),
    { timeout: 10_000 },
  );
  const touchScroll = await page.evaluate(() => {
    const scroller = document.createElement("div");
    scroller.style.cssText = "position:fixed;left:20px;top:120px;width:200px;height:100px;overflow-y:auto;z-index:9999";
    const content = document.createElement("div");
    content.style.height = "1000px";
    scroller.appendChild(content);
    document.body.appendChild(scroller);
    const dispatchTouch = (type, clientY) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, "touches", { value: [{ clientY }] });
      scroller.dispatchEvent(event);
      return event.defaultPrevented;
    };
    dispatchTouch("touchstart", 200);
    const movingWithinScrollerPrevented = dispatchTouch("touchmove", 100);
    scroller.scrollTop = scroller.scrollHeight - scroller.clientHeight;
    dispatchTouch("touchstart", 200);
    const movingPastBoundaryPrevented = dispatchTouch("touchmove", 100);
    scroller.remove();
    return { movingWithinScrollerPrevented, movingPastBoundaryPrevented };
  });
  assert(
    touchScroll.movingWithinScrollerPrevented === false,
    "One-finger movement inside a scrollable dialog is still blocked",
  );
  assert(
    touchScroll.movingPastBoundaryPrevented === true,
    "Background scroll lock no longer contains touch movement at a nested boundary",
  );

  await page.setViewport({ width: 1280, height: 900, isMobile: false, hasTouch: false });
  await page.goto(`${baseUrl}/bank`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector('button[aria-controls^="bank-math-domain-"]', { timeout: 60_000 });
  const domainControl = await page.$('button[aria-controls^="bank-math-domain-"]');
  assert(domainControl, "Keyboard-accessible domain control was not rendered");
  const domainPanelId = await domainControl.evaluate((button) => button.getAttribute("aria-controls"));
  const initiallyExpanded = await domainControl.evaluate((button) => button.getAttribute("aria-expanded") === "true");
  if (initiallyExpanded) {
    await domainControl.focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      (panelId) => [...document.querySelectorAll("button[aria-controls]")].some(
        (button) => button.getAttribute("aria-controls") === panelId
          && button.getAttribute("aria-expanded") === "false",
      ),
      { timeout: 10_000 },
      domainPanelId,
    );
  }
  const collapsedState = await domainControl.evaluate((button) => {
    const panelId = button.getAttribute("aria-controls");
    const panel = panelId ? document.getElementById(panelId) : null;
    const skillButton = panel?.querySelector("button:not([aria-label^='Shuffle'])");
    return {
      expanded: button.getAttribute("aria-expanded"),
      panelHidden: panel?.getAttribute("aria-hidden"),
      skillTabIndex: skillButton?.tabIndex,
    };
  });
  assert(collapsedState.expanded === "false", "Bank domain did not normalize to collapsed");
  assert(collapsedState.panelHidden === "true", "Collapsed bank domain remains exposed");
  assert(Number(collapsedState.skillTabIndex) < 0, "Collapsed bank skill remains keyboard focusable");
  await domainControl.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    (panelId) => [...document.querySelectorAll("button[aria-controls]")].some(
      (button) => button.getAttribute("aria-controls") === panelId
        && button.getAttribute("aria-expanded") === "true",
    ),
    { timeout: 10_000 },
    domainPanelId,
  );
  const domainState = await domainControl.evaluate((button) => {
    const panelId = button.getAttribute("aria-controls");
    const panel = panelId ? document.getElementById(panelId) : null;
    const skillButton = panel?.querySelector("button:not([aria-label^='Shuffle'])");
    return {
      expanded: button.getAttribute("aria-expanded"),
      panelHidden: panel?.getAttribute("aria-hidden"),
      skillTag: skillButton?.tagName,
      skillTabIndex: skillButton?.tabIndex,
    };
  });
  assert(domainState.expanded === "true", "Enter did not expand the bank domain");
  assert(domainState.panelHidden === "false", "Expanded bank domain remains aria-hidden");
  assert(domainState.skillTag === "BUTTON", "Bank skill action is not a native button");
  assert(Number(domainState.skillTabIndex) >= 0, "Expanded bank skill is not keyboard focusable");

  await page.goto(`${baseUrl}/bank/math/domain/Algebra?bankType=past`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForSelector(".bank-result-row", { timeout: 60_000 });
  const resultRowTags = await page.$$eval(
    ".bank-result-row",
    (rows) => rows.slice(0, 10).map((row) => row.tagName),
  );
  assert(resultRowTags.length > 0, "Filtered bank rendered no result rows");
  assert(resultRowTags.every((tag) => tag === "BUTTON"), "Filtered bank rows are not native buttons");
  assert(analyticsRequests.length === 0, `Analytics loaded without consent: ${analyticsRequests[0]}`);
  assert(consoleErrors.length === 0, `Browser console error: ${consoleErrors[0]}`);

  process.stdout.write(`${JSON.stringify({
    ok: true,
    mobileWindow,
    touchScroll,
    domainState,
    checkedResultRows: resultRowTags.length,
  }, null, 2)}\n`);
} finally {
  await page.close().catch(() => undefined);
  await browser.close().catch(() => undefined);
}
