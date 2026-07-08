# Backlink outreach daily queue

Status: active daily automation created. Automation id: `daily-backlink-outreach-replies-audit-and-send-queue`.

Immediate send status: first 10 direct emails sent from Zoho Mail on 2026-07-07.

Sender: Luke Finigan <luke@1600.now>

Cadence after approval: 10 outreach emails per day, starting with the highest-value direct email targets. Use no optional CCs on the first pass unless the primary contact bounces or the page explicitly asks for a departmental inbox.

Source draft file: `docs/BACKLINK_OUTREACH_SEND_DRAFTS.md`

## Active automation

- Schedule: once per day at 9:00 AM Pacific.
- Before sending, each run checks replies/bounces and uses actionable acceptance/rejection information to improve the remaining pending drafts.
- Each run sends at most 10 outreach emails.
- The run must read this queue first and select the next pending direct-email entries in order.
- The run must send from the Zoho mailbox `luke@1600.now`.
- The run must stop before any self-serve listing, contact form, or login-gated submission unless the prompt explicitly says forms are approved too.
- After each successful send, update that queue item from `pending` to `sent` with the date.
- If Zoho is logged out, blocked, asks for MFA, or shows a CAPTCHA, stop and report the blocker without sending.
- If any message has to differ materially from the draft, stop and ask for approval instead of improvising.

## Daily send rules

- Send from Zoho as `luke@1600.now`.
- Use the exact target, subject, and message from `docs/BACKLINK_OUTREACH_SEND_DRAFTS.md`, with only tiny recipient-specific edits if the target page has changed.
- Do not send to r/SAT, DEV Community, Hashnode, TPAPT, Strategic Test Prep, or Lumiere Education.
- Do not send to paid-prep companies in the first batch.
- Do not use scraped personal emails when the draft says to use a public contact page or general program contact.
- For contacts with alternates or optional CCs, send only to the primary address first.
- After sending, record the sent date and any bounce/reply in this file.

## Day 1: highest-value direct emails

1. Fairfax County Public Library - `wwwlib@fairfaxcounty.gov`
   - Draft: `### Fairfax County Public Library`
   - Why first: public library research guide, directly relevant SAT/test-prep page, strong institutional link fit.
   - Status: sent 2026-07-07

2. NC State University TRIO Upward Bound - `trio-programs@ncsu.edu`
   - Draft: `### NC State University TRIO Upward Bound`
   - Why first: .edu college-access program serving students who benefit from free prep.
   - Status: sent 2026-07-07

3. Indian River State College Library - `library@irsc.edu`
   - Draft: `### Indian River State College Library`
   - Why first: LibGuide already curates SAT/ACT resources and outside free tools.
   - Status: sent 2026-07-07

4. East Baton Rouge Parish Library - `eref@ebrpl.com`
   - Draft: `### East Baton Rouge Parish Library`
   - Why first: public library ACT/SAT guide with a maintained reference contact.
   - Status: sent 2026-07-07

5. North Shore Community College Library - `library@northshore.edu`
   - Draft: `### North Shore Community College Library`
   - Why first: .edu library guide, directly relevant SAT/ACT prep page.
   - Status: sent 2026-07-07

6. Project Upward Bound, Oakland University - `PUB@oakland.edu`
   - Draft: `### Project Upward Bound, Oakland University`
   - Why first: Upward Bound program, SAT resource page, strong mission fit.
   - Status: sent 2026-07-07

7. Heart of Texas GEAR UP - `gearup@tamu.edu`
   - Draft: `### Heart of Texas GEAR UP`
   - Why first: GEAR UP college-prep program with a directly relevant resources page.
   - Status: sent 2026-07-07

8. Upward Bound, Cal Poly SLO - `upwardbound@calpoly.edu`
   - Draft: `### Upward Bound, Cal Poly SLO`
   - Why first: Upward Bound program and tutoring/resources page.
   - Status: sent 2026-07-07

9. Capital Area College Access Network - `collegequestions@capcan.org`
   - Draft: `### Capital Area College Access Network`
   - Why first: college-access network with test-prep resources and public resource page.
   - Status: sent 2026-07-07

10. Get Schooled - `hello@getschooled.com`
    - Draft: `### Get Schooled`
    - Why first: national nonprofit article specifically about free SAT study help.
    - Status: sent 2026-07-07

## Day 2: strong direct emails

11. Mark Twain Library - `ryanne@marktwainlibrary.org`
    - Draft: `### Mark Twain Library`
    - Note: do not email the alternate unless the primary bounces.
    - Status: sent 2026-07-08

12. Bedford Public Library - `reference@bedfordnh.gov`
    - Draft: `### Bedford Public Library`
    - Status: sent 2026-07-08

13. Bound For College - `info@weareboundforcollege.org`
    - Draft: `### Bound For College`
    - Status: sent 2026-07-08

14. Clarkston High School - `skcarolin@clarkston.k12.mi.us`
    - Draft: `### Clarkston High School`
    - Status: sent 2026-07-08
    - Reply: out-of-office auto-reply received 2026-07-08; no action needed.

15. South Lake High School - `dominic.reid@solake.org`
    - Draft: `### South Lake High School`
    - Note: do not CC `christine.kingsley@solake.org` on first send.
    - Status: bounce/undeliverable 2026-07-08
    - Bounce: `dominic.reid@solake.org` rejected with 550 5.4.1 "Recipient address rejected: Access denied" from `solake-org.mail.protection.outlook.com`.

16. Stoney Creek High School - `nallen@rochester.k12.mi.us`
    - Draft: `### Stoney Creek High School`
    - Status: sent 2026-07-08
    - Reply: automatic reply received 2026-07-08; no action needed.

17. Centennial High School Counseling - `TruaxC1@fultonschools.org`
    - Draft: `### Centennial High School Counseling`
    - Note: do not CC `Peart@fultonschools.org` on first send.
    - Status: sent 2026-07-08

18. North Allegheny Senior High School - `jtreser@northallegheny.org`
    - Draft: `### North Allegheny Senior High School`
    - Status: sent 2026-07-08

19. Hopa Mountain - `info@hopamountain.org`
    - Draft: `### Hopa Mountain`
    - Status: pending

20. EnACT Your Future - `info@enactyourfuture.com`
    - Draft: `### EnACT Your Future`
    - Status: pending

## Day 3: remaining direct emails, then forms/listings

21. HSLDA Online Academy - `academy@hslda.org`
    - Draft: `### HSLDA Online Academy`
    - Status: pending

22. AMIDEAST - `dsaleh@amideast.org`
    - Draft: `### AMIDEAST`
    - Note: do not CC `inquiries@amideast.org` or `beirut@educationusa.org` on first send.
    - Status: pending

23. ISTE EdTech Index - `ltd-info@iste.org`
    - Draft: `### ISTE EdTech Index`
    - Note: only send if the product listing flow needs a support/request email.
    - Status: pending

24. EdTech Impact - `hello@edtechimpact.com`
    - Draft: `### EdTech Impact`
    - Note: prefer self-service onboarding first; email only if blocked.
    - Status: pending

After these, move to contact forms and self-serve submissions from `docs/BACKLINK_OUTREACH_SEND_DRAFTS.md`, starting with TeachersFirst, Freedom Homeschooling, How To Homeschool For FREE, MERLOT, OER Commons, ISTE, EdTech Impact, Curlie, Product Hunt, and AlternativeTo.
