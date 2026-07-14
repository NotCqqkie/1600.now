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
    - Status: bounce/undeliverable 2026-07-09
    - Bounce: `dominic.reid@solake.org` rejected with 550 5.4.1 "Recipient address rejected: Access denied" from `solake-org.mail.protection.outlook.com`.
    - Alternate attempt: `christine.kingsley@solake.org` sent after the primary bounce and rejected 2026-07-09 with 550 5.4.1 "Recipient address rejected: Access denied" from Outlook protection.

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
    - Reply: automatic summer-break reply received 2026-07-08; no action needed.

19. Hopa Mountain - `info@hopamountain.org`
    - Draft: `### Hopa Mountain`
    - Status: sent 2026-07-09

20. EnACT Your Future - `info@enactyourfuture.com`
    - Draft: `### EnACT Your Future`
    - Status: sent 2026-07-09

## Day 3: remaining direct emails, then forms/listings

21. HSLDA Online Academy - `academy@hslda.org`
    - Draft: `### HSLDA Online Academy`
    - Status: sent 2026-07-09

22. AMIDEAST - `dsaleh@amideast.org`
    - Draft: `### AMIDEAST`
    - Note: do not CC `inquiries@amideast.org` or `beirut@educationusa.org` on first send.
    - Status: bounce/undeliverable 2026-07-09
    - Bounce: `dsaleh@amideast.org` rejected with 550 5.4.1 "Recipient address rejected: Access denied" from `amideast-org.mail.protection.outlook.com`.

23. ISTE EdTech Index - `ltd-info@iste.org`
    - Draft: `### ISTE EdTech Index`
    - Note: only send if the product listing flow needs a support/request email.
    - Status: pending listing flow; not eligible for direct-email send until listing/form outreach is approved or blocked.

24. EdTech Impact - `hello@edtechimpact.com`
    - Draft: `### EdTech Impact`
    - Note: prefer self-service onboarding first; email only if blocked.
    - Status: pending listing flow; not eligible for direct-email send until listing/form outreach is approved or blocked.

After these, move to contact forms and self-serve submissions from `docs/BACKLINK_OUTREACH_SEND_DRAFTS.md`, starting with TeachersFirst, Freedom Homeschooling, How To Homeschool For FREE, MERLOT, OER Commons, ISTE, EdTech Impact, Curlie, Product Hunt, and AlternativeTo.

## Day 4: verified direct-email candidates

Mailbox duplicate audit completed in Zoho Inbox and Sent on 2026-07-12 before these entries were selected. Local master, queue, draft, and listing files were also cross-checked by organization, domain, recipient, and target URL.

25. Lake Michigan College Upward Bound - `jsall@lakemichigancollege.edu`
    - Draft: `### Lake Michigan College Upward Bound`
    - Target page: https://www.lakemichigancollege.edu/community/upward-bound
    - Score: 98/100
    - Evidence: SAT preparation is an active program service; Useful Links already contains an external SAT resource; Jacob Sall is the current official director.
    - Status: sent 2026-07-12 (confirmed in Zoho Sent; delivery state: In Retry Queue)

26. Whatcom Community College TRIO Upward Bound - `aroth@whatcom.edu`
    - Draft: `### Whatcom Community College TRIO Upward Bound`
    - Target page: https://www.whatcom.edu/current-students/funding-support-programs/upward-bound/resources
    - Score: 97/100
    - Evidence: exact page has a broad SAT and ACT preparation section and publishes Athena Roth as the current director.
    - Status: sent 2026-07-12 (confirmed in Zoho Sent; delivery state: Delivered)

27. Parkway Central High School - `NPrange@parkwayschools.net`
    - Draft: `### Parkway Central High School`
    - Target page: https://centralhigh.parkwayschools.net/student-support/counseling/testing
    - Score: 96/100
    - Evidence: current testing page maintains a FREE prep list; Nana Prange leads the counseling program that owns the page.
    - Status: sent 2026-07-12 (confirmed in Zoho Sent; delivery state: Delivered)

28. State College Area High School - `jls68@scasd.org`
    - Draft: `### State College Area High School`
    - Target page: https://hs.scasd.org/our-school/counseling/college-admissions-testing
    - Score: 96/100
    - Evidence: exact page lists current test dates, free external prep resources, and Jennifer Scudder as SAT Coordinator.
    - Status: sent 2026-07-12 (confirmed in Zoho Sent; delivery state: Delivered)

29. Washington State GEAR UP - `bethk@wsac.wa.gov`
    - Draft: `### Washington State GEAR UP`
    - Target page: https://gearup.wa.gov/grant-managers/free-test-preparation-tools-and-fee-waiver-info
    - Score: 96/100
    - Evidence: dedicated free-test-prep page; Beth Kelly's official assignment includes GEAR UP Communications, Website Resources & Publications.
    - Status: sent 2026-07-12 (confirmed in Zoho Sent; delivery state: Delivered)

30. Crestview Local School District - `asmith@crestviewlocal.k12.oh.us`
    - Draft: `### Crestview Local School District`
    - Target page: https://www.crestviewlocal.k12.oh.us/parent1/chs-counselor/college-and-fafsa-resourses/free-sat-prep
    - Score: 95/100
    - Evidence: dedicated free SAT page with external resources; current 2026-27 counseling materials identify Alannah Smith as the sole grades 9-12 counselor.
    - Status: sent 2026-07-12 (confirmed in Zoho Sent; delivery state: Delivered)
    - Reply: out-of-office auto-reply received 2026-07-12; Alannah Smith returns 2026-08-03. The alternate principal is for immediate assistance, so no alternate was contacted for this non-urgent request.

31. John R. Lewis High School Library - `mbmarquet@fcps.edu`
    - Draft: `### John R. Lewis High School Library`
    - Target page: https://lewishs-fcps.libguides.com/library/Testprep
    - Score: 95/100
    - Evidence: guide last updated 2026-06-16, curates several outside prep resources, and publishes Head Librarian Mimi Marquet's email as the maintainer contact.
    - Status: sent 2026-07-12 (confirmed in Zoho Sent; delivery state: Delivered)

32. Edmonds College Library - `haley.benjamins@edmonds.edu`
    - Draft: `### Edmonds College Library`
    - Target page: https://edcc.libguides.com/testprep/sat
    - Score: 95/100
    - Evidence: SAT guide is live, links outside practice, was updated 2026-05-08, and names Haley Benjamins as subject-guide owner.
    - Status: sent 2026-07-12 (confirmed in Zoho Sent; delivery state: Delivered)

33. Binghamton University TRIO Upward Bound - `isebuhar@binghamton.edu`
    - Draft: `### Binghamton University TRIO Upward Bound`
    - Target page: https://www.binghamton.edu/trio/upward-bound/families/studentresources.html
    - Score: 95/100
    - Evidence: SAT Prep section offers an external free practice link; current official contact page names Richie Sebuharara as director.
    - Status: sent 2026-07-12 (confirmed in Zoho Sent; delivery state: Delivered)
    - Reply: automated delayed-response notice received 2026-07-12; the Upward Bound Summer Program runs 2026-07-06 through 2026-08-07 and the director will check email periodically. No action needed.

34. Freedom and Citizenship at Columbia University - `fandc@columbia.edu`
    - Draft: `### Freedom and Citizenship at Columbia University`
    - Target page: https://freedomandcitizenship.columbia.edu/satprep-25-resources
    - Score: 94/100
    - Evidence: current Columbia program page curates free SAT tools with explicit selection rationales; the official program inbox replaces the old third-party personal address.
    - Status: sent 2026-07-12 (confirmed in Zoho Sent; delivery state: Delivered)

## Day 5: verified direct-email candidates sent 2026-07-12

Mailbox duplicate audit completed in Zoho Inbox and Sent on 2026-07-12. No new substantive reply, new bounce, or unrecorded prior send was found. Lake Michigan College remains in Zoho's retry queue and still counts as sent.

35. NCSSM Morganton Library - `jay.singley@ncssm.edu`
    - Draft: `### NCSSM Morganton Library`
    - Target page: https://ncssm-morganton.libguides.com/test-preparation/sat
    - Score: 94/100
    - Evidence: current Digital SAT guide updated 2026-03-24; named librarian owns the guide and it already links external practice.
    - Status: sent 2026-07-12 (confirmed in Zoho Sent; delivery state: Delivered)

36. University of Memphis Upward Bound - `ospayne@memphis.edu`
    - Draft: `### University of Memphis Upward Bound`
    - Target page: https://www.memphis.edu/upwardbound/studentresource/
    - Score: 94/100
    - Evidence: dedicated SAT Prep section has external resources; current official contact page identifies Ophrah Payne as program coordinator.
    - Status: sent 2026-07-12 (confirmed in Zoho Sent; delivery state: Delivered)

37. Skyline High School PTSA College Readiness - `collegereadiness@skylineptsa.org`
    - Draft: `### Skyline High School PTSA College Readiness`
    - Target page: https://skylineptsa.org/Page/Programs/Mock_Test_Summer
    - Score: 93/100
    - Evidence: current PTSA page maintains a neutral outside-resource list and publishes the role-specific email for its named College Readiness Chairs.
    - Status: sent 2026-07-12 (confirmed in Zoho Sent; delivery state: Delivered as of 2026-07-13 audit)
    - Reply: likely accepted 2026-07-12. Keerat, a Skyline PTSA College and Career Readiness Chair, said she will review 1600.now after 2026-07-17 and "make sure that it appears" under the requested section. She may ask Luke for a short call about the site; no immediate reply is required.

38. University of North Georgia Upward Bound - `upwardbound@ung.edu`
    - Draft: `### University of North Georgia Upward Bound`
    - Target page: https://ung.edu/upward-bound/resources.php
    - Score: 92/100
    - Evidence: exact page curates College Board, ACT, and SAT-prep links and explicitly designates the program inbox for contact.
    - Status: sent 2026-07-12 (confirmed in Zoho Sent; delivery state: Delivered as of 2026-07-13 audit)

39. Del Norte High School - `Joselyn.Glicco@aps.edu`
    - Draft: `### Del Norte High School`
    - Target page: https://delnorte.aps.edu/our-school/college-career-readiness/act-and-sat-testing
    - Score: 92/100
    - Evidence: page has a free and inexpensive prep list; the current official school directory identifies Joselyn Glicco as College/Career Readiness Counselor.
    - Status: sent 2026-07-12 (confirmed in Zoho Sent; delivery state: Delivered as of 2026-07-13 audit)

40. The Webb School Library and Archives - `hlittle@webbschool.com`
    - Draft: `### The Webb School Library and Archives`
    - Target page: https://thewebbschool.libguides.com/testprep
    - Score: 91/100
    - Evidence: guide has an Other Free Prep section, was updated 2025-09-11, and is owned by the current library director.
    - Status: sent 2026-07-12 (confirmed in Zoho Sent; delivery state: Delivered as of 2026-07-13 audit)

41. Christopher Columbus Educational Campus Library - `tchrismore@schools.nyc.gov`
    - Draft: `### Christopher Columbus Educational Campus Library`
    - Target page: https://sites.google.com/schools.nyc.gov/ccec-library-website/test-prep
    - Score: 90/100
    - Evidence: broad external test-prep list publishes Tina Chrismore as librarian; current surrounding library site confirms active ownership.
    - Status: sent 2026-07-12 (confirmed in Zoho Sent; delivery state: Delivered as of 2026-07-13 audit)

42. Oregon State University TRIO Upward Bound - `Virginia.Antunez@oregonstate.edu`
    - Draft: `### Oregon State University TRIO Upward Bound`
    - Target page: https://trio.oregonstate.edu/upward-bound/links-and-resources
    - Score: 89/100
    - Evidence: page links Khan Academy, BigFuture, and Oregon GEAR UP; Vicky Antunez is the current official associate director and page contact.
    - Status: sent 2026-07-12 (confirmed in Zoho Sent; delivery state: Delivered as of 2026-07-13 audit)

43. Howard County Public School System - `Kami_Wagner@hcpss.org`
    - Draft: `### Howard County Public School System`
    - Target page: https://www.hcpss.org/college-career-readiness/resources/
    - Score: 87/100
    - Evidence: counselor-reviewed College Admission Testing list links outside free and commercial prep; current directory identifies the central counseling coordinator.
    - Status: sent 2026-07-12 (confirmed in Zoho Sent; delivery state: Delivered as of 2026-07-13 audit)

44. West Park High School - `GLuna@rjuhsd.us`
    - Draft: `### West Park High School`
    - Target page: https://westpark.rjuhsd.us/services/college-career-center/testing-information
    - Score: 84/100
    - Evidence: current testing page links official practice and outside workshop resources; Grace Luna is the published contact for testing questions.
    - Status: sent 2026-07-12 (confirmed in Zoho Sent; delivery state: Delivered as of 2026-07-13 audit)
    - Reply: out-of-office auto-reply received 2026-07-12. Grace Luna returns 2026-08-03 and will respond after returning; no alternate was contacted.

## Day 6: verified direct-email candidates sent 2026-07-13

Zoho Inbox and Sent were audited on 2026-07-13 before selection. No new bounce or unrecorded outreach send was found. All candidate organizations, domains, recipients, and target URLs were also cross-checked against this queue, the master list, the listing tracker, the draft file, and the complete Zoho Sent listing. After Luke confirmed the batch, all ten messages were sent individually from `luke@1600.now`, reconciled against exact recipient and subject in Zoho Sent, and recorded below. The Inbox was checked again after sending; no immediate bounce or reply from these recipients was present.

45. Guyer High School - `mwells@dentonisd.org`
    - Draft: `### Guyer High School`
    - Target page: https://guyerhs.dentonisd.org/academics/testing
    - Score: 99/100
    - Evidence: current testing page has a broad FREE RESOURCES list; Mikayla Wells is the testing coordinator published on the page; March 3, 2026 Digital SAT details confirm maintenance.
    - Status: sent 2026-07-13 at 6:58 PM (confirmed in Zoho Sent; delivery state: Delivered)

46. Montclair State University Upward Bound - `gonzalezlia@montclair.edu`
    - Draft: `### Montclair State University Upward Bound`
    - Target page: https://www.montclair.edu/upward-bound/resources/
    - Score: 98/100
    - Evidence: dedicated Test Prep section links Khan Academy within a current college-access resource page; Liandy Gonzalez is the official project director.
    - Status: sent 2026-07-13 at 7:02 PM (confirmed in Zoho Sent; delivery state: Delivered)

47. DCPS Goes to College - `courtney.haddaway@k12.dc.gov`
    - Draft: `### DCPS Goes to College`
    - Target page: https://dcpsgoestocollege.org/college-exploration/psat-sat/
    - Score: 98/100
    - Evidence: current page curates Bluebook, College Board, and Khan Academy preparation; Courtney Haddaway Delph's official role covers SAT/PSAT testing and SAT test prep.
    - Status: sent 2026-07-13 at 7:03 PM (confirmed in Zoho Sent; delivery state: In Queue)

48. Snohomish High School College & Career Center - `kelsey.chaplin@sno.wednet.edu`
    - Draft: `### Snohomish High School College & Career Center`
    - Target page: https://shs.sno.wednet.edu/student-life/college-career-center
    - Score: 98/100
    - Evidence: exact page maintains a broad Free test preparation tools list and names Kelsey Chaplin as the College & Career Center Specialist.
    - Status: sent 2026-07-13 at 7:14 PM (confirmed in Zoho Sent; delivery state: Delivered)

49. Dakota High School Media Center - `kgroppuso@cvs.k12.mi.us`
    - Draft: `### Dakota High School Media Center`
    - Target page: https://www.chippewavalleyschools.org/schools/high-schools/dhs/media-center/sat-practice-/
    - Score: 97/100
    - Evidence: live SAT PREP page curates outside student resources; current Media Center page identifies Kirsten Groppuso as campus librarian and displays the July 2026 calendar.
    - Status: sent 2026-07-13 at 7:15 PM (confirmed in Zoho Sent; delivery state: Delivered)

50. Belleville East High School - `abarriger@bths201.org`
    - Draft: `### Belleville East High School`
    - Target page: https://bths201.org/belleville-east-home/be-counseling/college-career-readiness/
    - Score: 97/100
    - Evidence: focused Free SAT prep resources list already links College Board and Khan Academy; Andrea Barriger is the current Counseling Department Director.
    - Status: sent 2026-07-13 at 7:15 PM (confirmed in Zoho Sent; delivery state: Delivered)

51. California State University Monterey Bay GEAR UP - `dlozano@csumb.edu`
    - Draft: `### California State University Monterey Bay GEAR UP`
    - Target page: https://csumb.edu/studentlife/support/pre-college-programs/student-resources/
    - Score: 97/100
    - Evidence: current Test Preparation and Planning section groups SAT, ACT, and Khan Academy; Deserie Lozano is the official GEAR UP Associate Director.
    - Status: sent 2026-07-13 at 8:07 PM (confirmed in Zoho Sent; delivery state: In Queue)

52. Doss High School Library - `ashley.freeman@jefferson.kyschools.us`
    - Draft: `### Doss High School Library`
    - Target page: https://jcpsky.libguides.com/c.php?g=302959&p=7858210
    - Score: 97/100
    - Evidence: official LibGuide updated 2026-05-12 and links multiple outside SAT resources; current school directory identifies Ashley Freeman as librarian.
    - Status: sent 2026-07-13 at 8:08 PM (confirmed in Zoho Sent; delivery state: In Queue)

53. Central Piedmont Early College - `kellym.deantonio@cms.k12.nc.us`
    - Draft: `### Central Piedmont Early College`
    - Target page: https://sites.google.com/cms.k12.nc.us/cpec-school-counseling/act-sat
    - Score: 97/100
    - Evidence: current page has a dedicated other free test prep resources group; Kelly DeAntonio is the official Senior High Counselor and named testing-resource contact.
    - Status: sent 2026-07-13 at 8:50 PM (confirmed in Zoho Sent; delivery state: Delivered)

54. La Salle Academy Library - `ahajian@lasalle-academy.org`
    - Draft: `### La Salle Academy Library`
    - Target page: https://lasalle-academy.libguides.com/home/homeworkhelp
    - Score: 96/100
    - Evidence: guide updated 2026-06-22 and already pairs LearningExpress with College Board and Khan Academy; Andrea Hajian is the current librarian and guide owner.
    - Status: sent 2026-07-13 at 8:51 PM (confirmed in Zoho Sent; delivery state: Delivered)
