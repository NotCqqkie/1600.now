# Backlink outreach send drafts

Status: draft only. Do not submit, email, or publish anything until Luke approves.

Sender after mailbox setup: Luke Finigan <luke@1600.now>

Primary resource URL: https://1600.now

Core positioning used throughout: 1600.now is fully free and ad-free, built by a high school senior, and focused on current Digital SAT practice.

## Mailbox setup draft plan

Recommended provider: Zoho Mail.

Reason: 1600.now currently has no MX record, and the domain is on DigitalOcean nameservers. Zoho is the best default because it offers custom-domain mail without ads and has a free custom-domain tier for small personal use. Fastmail, Proton, and Google Workspace are cleaner paid alternatives, but they are not better enough for a single outreach inbox.

DNS work needed after signing into Zoho and DigitalOcean:

- Add Zoho MX records for `1600.now`.
- Add Zoho DKIM record after Zoho generates it.
- Add a DMARC record, likely `_dmarc.1600.now TXT "v=DMARC1; p=none; rua=mailto:luke@1600.now"`.
- Update the existing SPF TXT record, currently Firebase-only, so it includes Zoho while preserving Firebase sending if still needed.

## Excluded from this approval batch

- r/SAT subreddit wiki: excluded because Luke said not to do it.
- DEV Community and Hashnode: excluded for now because those are full article publishing opportunities, not simple forms, requests, or outreach messages. They need separate build-log posts if Luke wants them.

## Exact destinations from the outreach plan

Use these destinations when sending or submitting the drafts below. Anything login-gated still needs Luke approval and account access before submission.

| Target | Destination | Source page |
|---|---|---|
| Product Hunt | https://www.producthunt.com/posts/new | https://www.producthunt.com/posts/new |
| AlternativeTo | https://alternativeto.net/manage-item/ | https://alternativeto.net/manage-item/ |
| BetaList | https://betalist.com/submit | https://betalist.com/submit |
| SaaSHub | https://www.saashub.com/services/submit | https://www.saashub.com/submit |
| Uneed | https://www.uneed.best/submit-a-tool | https://www.uneed.best/submit-a-tool |
| Peerlist Launchpad | https://peerlist.io/launchpad | https://peerlist.io/launchpad |
| Indie Hackers - Products | https://www.indiehackers.com/products | https://www.indiehackers.com/products |
| Curlie (DMOZ successor) - Test Preparation category | https://curlie.org/public/suggest?cat=Reference/Education/Products_and_Services/Test_Preparation/SAT | https://curlie.org/en/Reference/Education/Products_and_Services/Test_Preparation/ |
| ISTE EdTech Index | ltd-info@iste.org | https://iste.org/edtech-index |
| EdTech Impact | hello@edtechimpact.com (on https://edtechimpact.com/contact-us); self-service signup via https://edtechimpact.com/account/product-onboarding/ (redirects to login/account creation) | https://edtechimpact.com/providers/ |
| MERLOT (California State University system) | https://info.merlot.org/merlothelp/Add_a_Material.htm (submission is via the logged-in Add a Material form at merlot.org) | https://www.merlot.org/ |
| OER Commons (ISKME) | https://help.oercommons.org/support/solutions/articles/42000046849-submit-oer (submission via oercommons.org logged-in 'Submit from Web' flow) | https://oercommons.org/ |
| TeachersFirst (The Source for Learning, nonprofit) | https://teachersfirst.org/contact.cfm | https://teachersfirst.org/contact.cfm |
| Freedom Homeschooling | https://freedomhomeschooling.com/submit-free-resource/ | https://freedomhomeschooling.com/ |
| How To Homeschool For FREE | https://docs.google.com/forms/d/e/1FAIpQLSeNrs-zGQAeU4NGRzY8fHxkSxcv3SX3nMWGr9o425jj8QrwXA/viewform | https://howtohomeschoolforfree.com/ |
| Hacker News - Show HN | https://news.ycombinator.com/submit | https://news.ycombinator.com/show |
| Fairfax County Public Library - Homework Help: Test Preparation guide | wwwlib@fairfaxcounty.gov | https://research.fairfaxcounty.gov/homework/test-prep |
| NC State University - TRIO Upward Bound Resources page | trio-programs@ncsu.edu | https://trio.dasa.ncsu.edu/upward-bound/resources/ |
| Indian River State College Library - Testing Resources: College Admission Tests (ACT/SAT) LibGuide | library@irsc.edu | https://irsc.libguides.com/testingresources/ACTSAT |
| East Baton Rouge Parish Library - ACT/SAT Prep InfoGuide | eref@ebrpl.com | https://ebrpl.libguides.com/actprep |
| Mark Twain Library (Redding, CT) - SAT and ACT Resources page | ryanne@marktwainlibrary.org (Ryanne Shemanskis, Teen Programmer); alternate: erin@marktwainlibrary.org (Erin Dummeyer, Library Director) | https://marktwainlibrary.org/sat-and-act-resources/ |
| Troy Public Library (Troy, MI) - Test Preparation online resources page | https://troypl.org/digital_library/online_resources/test_preparation.php (embedded email form on this page; phone 248-524-3538) | https://troypl.org/digital_library/online_resources/test_preparation.php |
| North Shore Community College Library - SAT and ACT Test Prep guide | library@northshore.edu | https://library.northshore.edu/test_prep_resources/sat_act |
| Bedford Public Library (Bedford, NH) - Khan Academy: Free SAT Prep resource listing | reference@bedfordnh.gov | https://bedfordnhlibrary.org/khan-academy-free-sat-prep |
| Project Upward Bound - Oakland University | PUB@oakland.edu | https://www.oakland.edu/upwardbound/resource-links/index |
| Heart of Texas GEAR UP (Texas A&M University) | gearup@tamu.edu | https://gearup.tamu.edu/college-prep-resources/ |
| Upward Bound - Cal Poly San Luis Obispo | upwardbound@calpoly.edu | https://upwardbound.calpoly.edu/tutoring-resources |
| Capital Area College Access Network (CapCAN) | collegequestions@capcan.org (also strasz@capcan.org, a named staff address) | https://capcan.org/explore-college/ |
| Bound For College (Palm Beach County, FL) | info@weareboundforcollege.org | https://weareboundforcollege.org/student-resources/ |
| Upward Bound Classic - University of Delaware | https://sites.udel.edu/upwardbound/contact/ (contact form; director Dr. John France, 302-831-4103) | https://sites.udel.edu/upwardbound/student-resources/sat-act-prep/ |
| Clarkston High School - SAT Review Resources (Clarkston Community Schools, MI) | skcarolin@clarkston.k12.mi.us (Shannon Carolin, counselor; full staff emails published at https://chs.clarkston.k12.mi.us/counseling/counseling-staff) | https://chs.clarkston.k12.mi.us/academics/learning-commons/sat-review-resources |
| Dakota High School - SAT Prep page (Chippewa Valley Schools, MI) | https://www.chippewavalleyschools.org/schools/high-schools/dhs/staff-directory/ (per-counselor email links: Ryan Anderson, Emily Gay, Terri Ede, Lisa Carr); district form at https://www.chippewavalleyschools.org/contact/ | https://www.chippewavalleyschools.org/schools/high-schools/dhs/guidance/actsatmme-testing/sat-prep/ |
| South Lake High School - SAT Resources / Khan Academy Free Test Prep (South Lake Schools, St. Clair Shores MI) | dominic.reid@solake.org (counselor A-G; also christine.kingsley@solake.org, both published at https://slhs.solake.org/apps/pages/index.jsp?uREC_ID=766584&type=d&pREC_ID=1170072) | https://slhs.solake.org/apps/pages/index.jsp?uREC_ID=1106153&type=d&pREC_ID=1387363 |
| Stoney Creek High School - Test Prep (Rochester Community Schools, MI) | nallen@rochester.k12.mi.us (Ms. Allen, counselor Ro-Z - listed on the current counseling page and with email published on the department's site stoneycreekhscounseling.weebly.com/contact.html) | https://schs.rochester.k12.mi.us/academics/test-prep |
| Centennial High School Counseling - SAT/ACT Prep Opportunities (Fulton County Schools, Roswell GA) | TruaxC1@fultonschools.org (Caroline Truax, College & Career Coordinator; dept head Hella Peart Peart@fultonschools.org, both published at https://www.mycentennialcounseling.com/contact-us/) | https://www.mycentennialcounseling.com/academics-2/sat-act-prep-opportunities/ |
| North Allegheny Senior High School - Free Online Khan Academy SAT Prep (North Allegheny SD, PA) | jtreser@northallegheny.org (Jennifer Treser, NASH counselor; full staff list with all five counselor emails at https://nash.northallegheny.org/resources/school-counseling - also rbielawski@, minsana@, kthompson@, mbuettner@northallegheny.org; secretaries jbutterini@ and sricci@northallegheny.org) | https://nash.northallegheny.org/resources/school-counseling/college-testing-information/satact-prep-options/free-online-khan-academy-sat-prep |
| R.K. Lloyde Continuation High School - Free SAT/ACT/PSAT/AP/SBAC Test Prep (Centinela Valley UHSD, Lawndale CA) | https://www.lloydehs.org/apps/staff/ (per-staff contact links; target Oscar Gutierrez, Academic Counselor, who owns the Counseling section) | https://www.lloydehs.org/apps/pages/index.jsp?uREC_ID=79826&type=d&pREC_ID=1590793 |
| Hopa Mountain - ACT/SAT Test Prep Resources (nonprofit) | info@hopamountain.org | https://www.hopamountain.org/isp/hs/actsattestprepresources |
| EnACT Your Future - '10 Free SAT Prep Resources' page | info@enactyourfuture.com | https://www.enactyourfuture.com/free-sat-resources.html |
| Get Schooled (national nonprofit) - "Where to Find Free SAT Study Help" | hello@getschooled.com | https://getschooled.com/article/5444-how-to-study-for-the-sat-test/ |
| Freedom and Citizenship at Columbia University - "Free SAT Prep Resources" | https://freedomandcitizenship.columbia.edu/people/jessica-harriet-lee (Executive Director Jessica Lee; email jessica.lee@columbia.edu per third-party directories, phone 212-854-6698; general staff emails on /about) | https://freedomandcitizenship.columbia.edu/satprep-25-resources |
| HSLDA Online Academy - "4 Free Resources for SAT Prep" | academy@hslda.org | https://academy.hslda.org/4-free-resources-for-sat-prep/ |
| TPAPT (Association of Test Prep, Admissions & Private Tutoring) - "Free & Low Cost Digital SAT Prep Resources for Your Students" | https://tpapt.mykajabi.com/contact-us | https://tpapt.mykajabi.com/blog/a-wealth-of-free-low-cost-digital-sat-prep-resources-for-your-students |
| Strategic Test Prep - "Best Digital SAT Prep Resources" (updated Dec 12, 2025) | info@strategictestprep.com | https://www.strategictestprep.com/post/best-digital-sat-prep-resources |
| Leading & Learning - "Best Free Materials to Prepare for the SAT" (July 16, 2025) | info@leadingandlearning.com | https://leadingandlearning.com/best-free-materials-to-prepare-for-the-sat/ |
| Colleges of Distinction - "FREE College Readiness SAT/ACT Test Prep Resources" | https://collegesofdistinction.com/contact-us/ | https://collegesofdistinction.com/advice/free-college-readiness-sat-act-test-prep-resources/ |
| CollegiateParent - "Apps to Make College Prep Easier" | https://collegiateparent.com/contact-us/ | https://collegiateparent.com/high-school/apps-to-make-college-prep-easier/ |
| Lumiere Education - '11 SAT Prep Courses that are Completely Free of Cost' | contact@lumiere.education | https://www.lumiere-education.com/post/10-sat-prep-courses-that-are-completely-free-of-cost |
| AMIDEAST (EducationUSA network operator for MENA) | dsaleh@amideast.org (advising page contact; general: inquiries@amideast.org; center adviser: beirut@educationusa.org) | https://www.amideast.org/our-work/study-in-the-usa/education-advising/educational-advising |
| EducationUSA at U.S. Embassy Tashkent (Uzbekistan) | https://educationusa.state.gov/email/node/427/field_center_email_forwarder | https://educationusa.state.gov/centers/educationusa-us-embassy-tashkent |
| InternationalStudent.com (Envisage International) | https://www.internationalstudent.com/contact/ | https://www.internationalstudent.com/test-prep/sat/ |

## Self-serve launches, directories, and submission forms

### Product Hunt

Target: https://www.producthunt.com/posts/new

Submission type: launch/profile listing. Exact fields may vary by account state.

Name:

1600.now

Tagline:

Free, ad-free Digital SAT practice with 7,600+ questions

Description:

I'm a high school senior, and I built 1600.now after seeing how quickly serious SAT prep becomes expensive, limited, or cluttered with upsells.

1600.now is fully free and ad-free. It has 7,600+ Digital SAT practice questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can start in the browser without creating an account or paying.

Website:

https://1600.now

Topics:

Education, Students, Productivity

Maker comment:

I built 1600.now because most serious SAT prep either costs money, caps useful practice, or is built around the old paper SAT. The goal is simple: give students a current Digital SAT practice site that is fully free, ad-free, and useful enough to actually replace paid prep for a lot of students.

It includes 7,600+ questions, answer explanations, adaptive modules, a score calculator, and vocabulary practice. I'm especially hoping it helps students who cannot justify paying for another prep subscription.

### AlternativeTo

Target: https://alternativeto.net/manage-item/

Submission type: software listing.

Name:

1600.now

Website:

https://1600.now

Short description:

Fully free, ad-free Digital SAT practice platform.

Long description:

1600.now is a fully free, ad-free Digital SAT practice platform for high school students. It includes 7,600+ practice questions, answer explanations, adaptive practice modules, a score calculator, and vocabulary practice. Students can use it in the browser without payment.

Category:

Education

Tags:

SAT, Digital SAT, test prep, education, practice questions, college admissions

Pricing:

Free

### BetaList

Target: https://betalist.com/submit

Submission type: startup listing.

Startup name:

1600.now

URL:

https://1600.now

Pitch:

1600.now is a fully free, ad-free Digital SAT practice platform built by a high school senior for students who need serious prep without paying for a course. It includes 7,600+ questions, full answer explanations, adaptive practice modules, a score calculator, and vocab practice. Students can start in the browser with no account required.

Founder:

Luke Finigan

Market:

Education, test prep, high school students

### SaaSHub

Target: https://www.saashub.com/submit

Submission type: product listing.

Product name:

1600.now

Website:

https://1600.now

Tagline:

Fully free, ad-free Digital SAT practice

Description:

1600.now is a fully free, ad-free Digital SAT practice platform with 7,600+ questions, answer explanations, adaptive practice modules, a score calculator, and vocabulary practice. It is built for the current digital, adaptive SAT and students can start practicing without creating an account or paying.

Category:

Education

Tags:

Digital SAT, SAT prep, test prep, students, practice questions

### Uneed

Target: https://www.uneed.best/submit-a-tool

Submission type: product/tool listing.

Product name:

1600.now

Website:

https://1600.now

Short description:

Fully free, ad-free Digital SAT practice with 7,600+ questions.

Full description:

1600.now is a fully free, ad-free web app for Digital SAT prep. It includes 7,600+ practice questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can start practicing in the browser without an account or payment.

Category:

Education

Pricing:

Free

### Peerlist Launchpad

Target: https://peerlist.io/launchpad

Submission type: launch listing.

Product name:

1600.now

Website:

https://1600.now

Tagline:

Free, ad-free Digital SAT prep for students

Description:

1600.now is a fully free, ad-free Digital SAT practice platform built by a high school senior. It includes 7,600+ questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can start in the browser without an account or payment.

Launch note:

I built this because serious SAT prep is still too often limited by price, accounts, or upsells. 1600.now is meant to be a practical free option for students who want current Digital SAT practice.

### Indie Hackers Products

Target: https://www.indiehackers.com/products

Submission type: product listing.

Product name:

1600.now

Website:

https://1600.now

Description:

1600.now is a fully free, ad-free Digital SAT practice platform I built as a high school senior. It has 7,600+ practice questions, answer explanations, adaptive modules, a score calculator, and vocabulary practice. Students can start practicing without an account or payment.

What are you working on:

I'm building a free SAT prep site that can be useful enough for students who cannot pay for commercial prep. The current version focuses on Digital SAT practice, answer explanations, adaptive modules, a score calculator, and vocabulary.

### Curlie

Target: https://curlie.org/public/suggest?cat=Reference/Education/Products_and_Services/Test_Preparation/SAT

Submission type: directory suggestion.

Site title:

1600.now

Site URL:

https://1600.now

Description:

Fully free, ad-free online Digital SAT practice site with practice questions, answer explanations, adaptive modules, a score calculator, and vocabulary practice.

Category:

Reference/Education/Products and Services/Test Preparation/SAT

### ISTE EdTech Index

Target: https://ltd.iste.org

Submission type: edtech product/resource listing request.

Product name:

1600.now

Website:

https://1600.now

Description:

1600.now is a fully free, ad-free web-based Digital SAT practice resource for high school students. It includes 7,600+ practice questions, written explanations, adaptive practice modules, a score calculator, and vocabulary practice. It can be used independently by students or shared by teachers, counselors, libraries, and college-access programs.

Audience:

High school students, teachers, counselors, college-access programs

Pricing:

Free

### EdTech Impact

Target: https://edtechimpact.com/account/product-onboarding/

Submission type: product listing.

Product name:

1600.now

Website:

https://1600.now

Description:

1600.now is a fully free, ad-free Digital SAT practice platform for high school students. It includes 7,600+ questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can use it independently, and educators or counselors can share it as a free SAT prep resource.

Age range:

High school

Subject:

College readiness, SAT preparation

Pricing:

Free

### MERLOT

Target: https://info.merlot.org/merlothelp/Add_a_Material.htm

Submission type: learning material submission.

Title:

1600.now

URL:

https://1600.now

Description:

1600.now is a fully free, ad-free web-based Digital SAT practice resource for high school students. It includes 7,600+ practice questions, answer explanations, adaptive practice modules, a score calculator, and vocabulary practice. Students can use it independently, and teachers, librarians, and college-access staff can share it as a no-cost test prep resource.

Material type:

Learning exercise

Audience:

High school students

Subject:

Test preparation, college readiness

### OER Commons

Target: https://help.oercommons.org/support/solutions/articles/42000046849-submit-oer

Submission type: open education resource submission.

Title:

1600.now

URL:

https://1600.now

Abstract:

1600.now is a fully free, ad-free Digital SAT practice resource for high school students. It includes 7,600+ questions, answer explanations, adaptive practice modules, a score calculator, and vocabulary practice. It can be used by students on their own or shared by teachers, counselors, libraries, and college-access programs.

Education level:

High school

Subject:

College readiness, test preparation, English language arts, mathematics

Cost:

Free

### TeachersFirst

Target: https://teachersfirst.org/contact.cfm

Submission type: resource suggestion.

Resource title:

1600.now

URL:

https://1600.now

Description:

I'd like to suggest 1600.now for review as a free Digital SAT practice resource.

I'm a high school senior, and I built it after seeing how hard it is for students to get enough realistic SAT practice without paying. The site is fully free and ad-free. It includes 7,600+ practice questions, explanations for every answer, adaptive practice modules in the current Digital SAT format, a score calculator, and vocabulary practice.

Audience:

High school students preparing for the SAT.

### Freedom Homeschooling

Target: https://freedomhomeschooling.com/submit-free-resource/

Submission type: contact form.

Subject:

Free ad-free Digital SAT prep resource

Message:

Hi,

I saw that Freedom Homeschooling shares free resources for homeschool families, including high school and college-prep resources. I wanted to suggest 1600.now for families looking for SAT prep.

I'm a high school senior, and I built 1600.now after seeing how expensive serious SAT prep can get. The site is fully free and ad-free. It has 7,600+ Digital SAT practice questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can start in the browser without creating an account or paying.

Resource: https://1600.now

Grades: 9-12

Subject: SAT prep and college readiness

Thanks for considering it.

Luke Finigan

### How To Homeschool For FREE

Target: https://docs.google.com/forms/d/e/1FAIpQLSeNrs-zGQAeU4NGRzY8fHxkSxcv3SX3nMWGr9o425jj8QrwXA/viewform

Submission type: contact form.

Subject:

Free ad-free Digital SAT prep resource for high school students

Message:

Hi,

I saw that How To Homeschool For FREE curates free resources for homeschool families, so I wanted to suggest a free SAT prep resource for high school students.

I'm a high school senior, and I built 1600.now to make realistic Digital SAT practice easier to access. It is fully free and ad-free. It includes 7,600+ practice questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can start in the browser without creating an account or paying.

Resource: https://1600.now

Grades: 9-12

Subject: SAT prep and college readiness

Thanks for considering it.

Luke Finigan

### Hacker News Show HN

Target: https://news.ycombinator.com/submit

Submission type: Show HN post.

Title:

Show HN: I built a free, ad-free Digital SAT practice site

URL:

https://1600.now

Comment:

I'm a high school senior, and I built 1600.now after seeing how quickly serious SAT prep becomes expensive, limited, or filled with upsells.

The site is fully free and ad-free. It has 7,600+ Digital SAT practice questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can start practicing in the browser without creating an account.

I'm hoping it helps students who need more realistic practice but cannot justify paying for a prep course or subscription.

## Libraries, college-access programs, and school resource pages

### Fairfax County Public Library

Target: wwwlib@fairfaxcounty.gov

Research note: FCPL has student homework and test-prep resources, including SAT prep links, so this should be framed as an additional no-cost resource for patrons.

Subject:

Free ad-free Digital SAT prep resource for FCPL students

Message:

Hi,

I saw that Fairfax County Public Library shares homework and test-prep resources for students. I wanted to suggest one more free option for students preparing for the Digital SAT.

I'm a high school senior, and I built 1600.now after seeing how quickly serious SAT prep becomes expensive or limited. The site is fully free and ad-free. It has 7,600+ Digital SAT questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can use it in the browser without an account or payment.

Resource: https://1600.now

Thanks for considering it.

Luke Finigan

### NC State University TRIO Upward Bound

Target: trio-programs@ncsu.edu

Research note: NC State TRIO Upward Bound supports college readiness, and its resource lists already point students toward test-prep help.

Subject:

Free ad-free Digital SAT prep resource for Upward Bound students

Message:

Hi,

I saw that NC State's TRIO Upward Bound program shares college-readiness and test-prep resources with students. I wanted to suggest 1600.now as another free SAT option.

I'm a high school senior, and I built 1600.now because many students need more realistic SAT practice than they can get from a short list of links or paid prep tools. The site is fully free and ad-free. It includes 7,600+ Digital SAT questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can start in the browser without creating an account or paying.

Resource: https://1600.now

Thanks for considering it for your students.

Luke Finigan

### Indian River State College Library

Target: library@irsc.edu

Research note: IRSC Library maintains college admission test prep guides, including SAT and ACT resources.

Subject:

Free ad-free Digital SAT resource for your test prep guide

Message:

Hi,

I saw that Indian River State College Library maintains guides for college admission test preparation. I wanted to suggest a free current Digital SAT resource that may fit your SAT prep page.

I'm a high school senior, and I built 1600.now to make realistic SAT practice easier to access. The site is fully free and ad-free. It has 7,600+ Digital SAT questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can use it in the browser without an account or payment.

Resource: https://1600.now

Thanks for considering it.

Luke Finigan

### East Baton Rouge Parish Library

Target: eref@ebrpl.com

Research note: EBRPL has ACT/SAT prep information for library users.

Subject:

Free ad-free Digital SAT prep resource for EBRPL students

Message:

Hi,

I saw that East Baton Rouge Parish Library shares ACT and SAT prep information for students. I wanted to suggest another free SAT practice resource for that page.

I'm a high school senior, and I built 1600.now after seeing how much SAT practice is either paid, capped, or outdated for the Digital SAT. The site is fully free and ad-free. It includes 7,600+ Digital SAT questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can use it in the browser without an account or payment.

Resource: https://1600.now

Thanks for considering it.

Luke Finigan

### Mark Twain Library

Target: ryanne@marktwainlibrary.org; alternate erin@marktwainlibrary.org

Research note: Mark Twain Library lists teen test-prep resources such as College Board, ACT, Khan Academy, Method Test Prep, and Brainfuse.

Subject:

Free ad-free Digital SAT prep resource for teen patrons

Message:

Hi,

I saw that Mark Twain Library shares test-prep resources for teen patrons, including SAT resources. I wanted to suggest one more free Digital SAT option.

I'm a high school senior, and I built 1600.now because students often need more practice than they can get from a few official links or paid tools. The site is fully free and ad-free. It includes 7,600+ Digital SAT questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can start in the browser without creating an account or paying.

Resource: https://1600.now

Thanks for considering it.

Luke Finigan

### Troy Public Library

Target: https://troypl.org/digital_library/online_resources/test_preparation.php

Research note: Troy Public Library has a test preparation page with SAT prep resources.

Subject:

Free ad-free Digital SAT prep resource for your test prep page

Message:

Hi,

I saw that Troy Public Library has a test preparation page with SAT resources. I wanted to suggest a free current Digital SAT practice site for students using that page.

I'm a high school senior, and I built 1600.now to make realistic SAT practice easier to access. The site is fully free and ad-free. It includes 7,600+ Digital SAT questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can use it in the browser without an account or payment.

Resource: https://1600.now

Thanks for considering it.

Luke Finigan

### North Shore Community College Library

Target: library@northshore.edu

Research note: North Shore Community College Library has SAT and ACT guides for students.

Subject:

Free ad-free Digital SAT resource for your SAT guide

Message:

Hi,

I saw that North Shore Community College Library maintains SAT and ACT prep guides. I wanted to suggest 1600.now as another free Digital SAT resource for students.

I'm a high school senior, and I built 1600.now because realistic SAT practice is often either paid or scattered across older resources. The site is fully free and ad-free. It includes 7,600+ Digital SAT questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can start in the browser without an account or payment.

Resource: https://1600.now

Thanks for considering it.

Luke Finigan

### Bedford Public Library

Target: reference@bedfordnh.gov

Research note: Bedford Public Library links free SAT prep resources for students.

Subject:

Free ad-free Digital SAT prep resource for Bedford students

Message:

Hi,

I saw that Bedford Public Library shares free SAT prep resources. I wanted to suggest another free option that is built specifically for the current Digital SAT.

I'm a high school senior, and I built 1600.now after seeing how hard it is to find enough realistic SAT practice without paying. The site is fully free and ad-free. It includes 7,600+ Digital SAT questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can use it in the browser without an account or payment.

Resource: https://1600.now

Thanks for considering it.

Luke Finigan

### Project Upward Bound, Oakland University

Target: PUB@oakland.edu

Research note: Oakland University Project Upward Bound shares academic and college-prep resources, including SAT-related resources.

Subject:

Free ad-free Digital SAT prep resource for Project Upward Bound students

Message:

Hi,

I saw that Oakland University's Project Upward Bound shares academic resources for students, including SAT prep links. I wanted to suggest 1600.now as another free option.

I'm a high school senior, and I built 1600.now because students preparing for the SAT need a lot of practice, and many serious options cost money. The site is fully free and ad-free. It includes 7,600+ Digital SAT questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can start in the browser without creating an account or paying.

Resource: https://1600.now

Thanks for considering it for your students.

Luke Finigan

### Heart of Texas GEAR UP

Target: gearup@tamu.edu

Research note: Heart of Texas GEAR UP shares college prep and test prep resources for students.

Subject:

Free ad-free Digital SAT prep resource for GEAR UP students

Message:

Hi,

I saw that Heart of Texas GEAR UP shares college-prep resources for students. I wanted to suggest a free Digital SAT practice site that may be useful for your resource list.

I'm a high school senior, and I built 1600.now to give students more realistic SAT practice without a paywall. The site is fully free and ad-free. It includes 7,600+ Digital SAT questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can use it in the browser without an account or payment.

Resource: https://1600.now

Thanks for considering it.

Luke Finigan

### Upward Bound, Cal Poly SLO

Target: upwardbound@calpoly.edu

Research note: Cal Poly Upward Bound shares tutoring and academic resources, including Khan Academy.

Subject:

Free ad-free Digital SAT prep resource for Upward Bound students

Message:

Hi,

I saw that Cal Poly's Upward Bound program shares tutoring and academic resources for students. I wanted to suggest 1600.now as a free SAT prep resource you could share with students preparing for the Digital SAT.

I'm a high school senior, and I built 1600.now because serious SAT practice is often expensive or limited. The site is fully free and ad-free. It includes 7,600+ Digital SAT questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can start in the browser without an account or payment.

Resource: https://1600.now

Thanks for considering it.

Luke Finigan

### Capital Area College Access Network

Target: collegequestions@capcan.org; optional cc strasz@capcan.org

Research note: CapCAN shares college access and test preparation resources for students.

Subject:

Free ad-free Digital SAT prep resource for CapCAN students

Message:

Hi,

I saw that CapCAN shares college access resources and test-prep tools with students. I wanted to suggest 1600.now as another free SAT prep option.

I'm a high school senior, and I built 1600.now to make realistic Digital SAT practice easier to access. The site is fully free and ad-free. It includes 7,600+ Digital SAT questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can use it in the browser without creating an account or paying.

Resource: https://1600.now

Thanks for considering it.

Luke Finigan

### Bound For College

Target: info@weareboundforcollege.org

Research note: Bound For College has student resources for college preparation, including SAT and ACT resources.

Subject:

Free ad-free Digital SAT prep resource for Bound For College students

Message:

Hi,

I saw that Bound For College shares student resources for college preparation, including SAT and ACT support. I wanted to suggest 1600.now as another free SAT option.

I'm a high school senior, and I built 1600.now after seeing how quickly serious SAT prep becomes expensive or limited. The site is fully free and ad-free. It includes 7,600+ Digital SAT questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can start in the browser without an account or payment.

Resource: https://1600.now

Thanks for considering it for your students.

Luke Finigan

### Upward Bound Classic, University of Delaware

Target: https://sites.udel.edu/upwardbound/contact/

Research note: University of Delaware Upward Bound Classic shares SAT and ACT prep resources for students.

Subject:

Free ad-free Digital SAT prep resource for Upward Bound Classic students

Message:

Hi,

I saw that the University of Delaware Upward Bound Classic program shares SAT and ACT prep resources. I wanted to suggest a free Digital SAT resource that may be useful for your students.

I'm a high school senior, and I built 1600.now to make realistic SAT practice easier to access. The site is fully free and ad-free. It includes 7,600+ Digital SAT questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can use it in the browser without creating an account or paying.

Resource: https://1600.now

Thanks for considering it.

Luke Finigan

### Clarkston High School

Target: skcarolin@clarkston.k12.mi.us

Research note: Clarkston High School has SAT review resources for students.

Subject:

Free ad-free Digital SAT prep resource for your SAT resources page

Message:

Hi,

I saw Clarkston High School's SAT resources page and wanted to suggest one more free resource for students preparing for the current Digital SAT.

I'm a high school senior, and I built 1600.now after seeing how many students rely on a short list of links or paid prep tools. The site is fully free and ad-free. It includes 7,600+ Digital SAT questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can start in the browser without creating an account or paying.

Resource: https://1600.now

Thanks for considering it for the page.

Luke Finigan

### Dakota High School

Target: https://www.chippewavalleyschools.org/schools/high-schools/dhs/staff-directory/

Research note: Dakota High School has SAT resources, including older practice app and test-prep links.

Subject:

Free ad-free Digital SAT prep resource for Dakota students

Message:

Hi,

I saw Dakota High School's SAT resources page and wanted to suggest a current Digital SAT practice resource for students.

I noticed the page still points students toward older SAT app resources, including retired College Board Daily Practice style links. Those made sense for the old paper SAT, but they are not a great match for students taking the current Digital SAT.

I'm a high school senior, and I built 1600.now as a current replacement students can start using right away. The site is fully free and ad-free. It includes 7,600+ Digital SAT questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can use it in the browser without an account or payment.

Resource: https://1600.now

Thanks for considering it for the page.

Luke Finigan

### South Lake High School

Target: dominic.reid@solake.org; optional cc christine.kingsley@solake.org

Research note: South Lake High School has SAT resources for students.

Subject:

Free ad-free Digital SAT prep resource for South Lake students

Message:

Hi,

I saw South Lake High School's SAT resources page and wanted to suggest a free resource built for the current Digital SAT.

The page currently leans on older Khan Academy and College Board SAT setup language from the paper-SAT era. Students can still use Khan, but the Digital SAT is adaptive now, so I wanted to suggest a resource built around the current format.

I'm a high school senior, and I built 1600.now after seeing how hard it is to get enough realistic SAT practice without paying. The site is fully free and ad-free. It includes 7,600+ Digital SAT questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can start in the browser without creating an account or paying.

Resource: https://1600.now

Thanks for considering it.

Luke Finigan

### Stoney Creek High School

Target: nallen@rochester.k12.mi.us

Research note: Stoney Creek High School has a counseling test prep page with SAT resources.

Subject:

Free ad-free Digital SAT prep resource for your test prep page

Message:

Hi,

I saw Stoney Creek High School's test prep page and wanted to suggest a free Digital SAT practice resource for students.

I noticed the page still points students toward older paper-SAT Khan Academy material and a LearningExpress link that may not work cleanly for users outside the library flow. I wanted to suggest a current resource that students can open directly.

I'm a high school senior, and I built 1600.now because students need a lot of realistic practice, and many SAT prep tools are paid or limited. The site is fully free and ad-free. It includes 7,600+ Digital SAT questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can use it in the browser without an account or payment.

Resource: https://1600.now

Thanks for considering it for the page.

Luke Finigan

### Centennial High School Counseling

Target: TruaxC1@fultonschools.org; optional cc Peart@fultonschools.org

Research note: Centennial High School Counseling lists SAT, ACT, and PSAT prep opportunities for students.

Subject:

Free ad-free Digital SAT prep resource for your prep opportunities page

Message:

Hi,

I saw Centennial High School's SAT, ACT, and PSAT prep opportunities page and wanted to suggest one more free SAT resource for students.

I also noticed the page still references older resources like Number2 and the retired College Board/Khan Official SAT Practice signup flow. 1600.now is built for the current Digital SAT, so it may be a useful update for students using that page.

I'm a high school senior, and I built 1600.now to make realistic Digital SAT practice easier to access. The site is fully free and ad-free. It includes 7,600+ Digital SAT questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can start in the browser without creating an account or paying.

Resource: https://1600.now

Thanks for considering it for the page.

Luke Finigan

### North Allegheny Senior High School

Target: jtreser@northallegheny.org

Research note: North Allegheny shares free online Khan Academy SAT prep information for students.

Subject:

Free ad-free Digital SAT prep resource for North Allegheny students

Message:

Hi,

I saw North Allegheny's SAT prep resources and wanted to suggest another free option students can use alongside official practice.

The page still describes the old College Board account-linking setup for Khan Academy, which was useful before the SAT moved fully digital. I wanted to suggest a current free resource that students can open directly.

I'm a high school senior, and I built 1600.now after seeing how students often need more realistic practice than a small set of official tests. The site is fully free and ad-free. It includes 7,600+ Digital SAT questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can use it in the browser without an account or payment.

Resource: https://1600.now

Thanks for considering it.

Luke Finigan

### R.K. Lloyde Continuation High School

Target: https://www.lloydehs.org/apps/staff/

Research note: R.K. Lloyde lists free SAT, ACT, PSAT, AP, and SBAC test prep resources.

Subject:

Free ad-free Digital SAT prep resource for your test prep page

Message:

Hi,

I saw R.K. Lloyde's free test prep page and wanted to suggest a current Digital SAT resource for students.

I noticed the page includes older SAT prep links, including Number2 and paper-SAT-era College Board resources. Those links are not as helpful for students preparing for the current digital, adaptive test.

I'm a high school senior, and I built 1600.now as a free current option. The site is fully free and ad-free. It includes 7,600+ Digital SAT questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can start in the browser without an account or payment.

Resource: https://1600.now

Thanks for considering it for the page.

Luke Finigan

### Hopa Mountain

Target: info@hopamountain.org

Research note: Hopa Mountain shares High School Scholars ACT and SAT resources.

Subject:

Free ad-free Digital SAT prep resource for High School Scholars

Message:

Hi,

I saw that Hopa Mountain shares online ACT and SAT resources for High School Scholars. I wanted to suggest 1600.now as another free SAT option for students.

I noticed a few resources on the SAT prep page look stale, including PrepFactory and Testive. 1600.now would give students a current Digital SAT option that is open in the browser.

I'm a high school senior, and I built 1600.now to make realistic Digital SAT practice easier to access. The site is fully free and ad-free. It includes 7,600+ Digital SAT questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can use it without creating an account or paying.

Resource: https://1600.now

Thanks for considering it.

Luke Finigan

### EnACT Your Future

Target: info@enactyourfuture.com

Research note: EnACT Your Future has a free SAT prep resources article.

Subject:

Free ad-free Digital SAT prep resource for your SAT prep list

Message:

Hi,

I saw EnACT Your Future's list of free SAT prep resources and wanted to suggest a current Digital SAT practice site for a future update.

Some of the resources on the list are still useful, but a few are from the old paper-SAT era or look stale now. 1600.now is built for the current Digital SAT format.

I'm a high school senior, and I built it after seeing how hard it is to find enough realistic SAT practice without paying. The site is fully free and ad-free. It includes 7,600+ Digital SAT questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can start in the browser without creating an account or paying.

Resource: https://1600.now

Thanks for considering it.

Luke Finigan

## Article/list update outreach

### Get Schooled

Target: hello@getschooled.com

Research note: Get Schooled has an article on where to find free SAT study help.

Subject:

Free ad-free Digital SAT prep resource for your SAT study help article

Message:

Hi,

I saw Get Schooled's article on where students can find free SAT study help. I wanted to suggest 1600.now for a future update.

I'm a high school senior, and I built it after seeing how quickly serious SAT prep becomes expensive, limited, or cluttered with upsells. 1600.now is fully free and ad-free. It includes 7,600+ Digital SAT questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can start in the browser without creating an account or paying.

Resource: https://1600.now

Thanks for considering it.

Luke Finigan

### Freedom and Citizenship at Columbia University

Target: jessica.lee@columbia.edu

Research note: Freedom and Citizenship has a student-built free SAT prep resources page.

Subject:

Free ad-free Digital SAT prep resource for your free SAT prep page

Message:

Hi,

I saw the Freedom and Citizenship free SAT prep resources page. Since it already highlights student-friendly free SAT materials, I wanted to suggest one more current Digital SAT resource.

I'm a high school senior, and I built 1600.now to make serious SAT practice easier to access. It is fully free and ad-free. It includes 7,600+ Digital SAT questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can use it in the browser without creating an account or paying.

Resource: https://1600.now

Thanks for considering it for the page.

Luke Finigan

### HSLDA Online Academy

Target: academy@hslda.org

Research note: HSLDA Online Academy has an article on free SAT prep resources for homeschool families.

Subject:

Free ad-free Digital SAT prep resource for your SAT prep article

Message:

Hi,

I saw HSLDA Online Academy's article on free SAT prep resources and wanted to suggest one more free Digital SAT option for a future update.

I'm a high school senior, and I built 1600.now after seeing how expensive serious SAT prep can get. The site is fully free and ad-free. It includes 7,600+ Digital SAT questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can start in the browser without an account or payment.

Resource: https://1600.now

Thanks for considering it.

Luke Finigan

### TPAPT

Target: https://tpapt.mykajabi.com/contact-us

Research note: TPAPT publishes test-prep resource posts, including free and low-cost Digital SAT resources.

Subject:

Free ad-free Digital SAT resource for your prep resource lists

Message:

Hi,

I saw TPAPT's Digital SAT resource coverage and wanted to suggest 1600.now for a future free-resource update.

I'm a high school senior, and I built 1600.now because many students need more practice than they can get from official tests alone, but paid prep is not realistic for everyone. The site is fully free and ad-free. It has 7,600+ Digital SAT questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice.

Resource: https://1600.now

Thanks for considering it.

Luke Finigan

### Strategic Test Prep

Target: info@strategictestprep.com

Research note: Strategic Test Prep publishes Digital SAT prep resource roundups.

Subject:

Free ad-free Digital SAT practice resource for your resource roundup

Message:

Hi,

I saw Strategic Test Prep's Digital SAT resource roundup and wanted to suggest 1600.now as a free practice option for a future update.

I'm a high school senior, and I built it after seeing that students often need more practice than a few official tests can provide. 1600.now is fully free and ad-free. It includes 7,600+ Digital SAT questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can start in the browser without an account or payment.

Resource: https://1600.now

Thanks for considering it.

Luke Finigan

### Leading & Learning

Target: info@leadingandlearning.com

Research note: Leading & Learning publishes free SAT prep material recommendations.

Subject:

Free ad-free Digital SAT practice resource for your SAT materials list

Message:

Hi,

I saw Leading & Learning's article on free SAT preparation materials and wanted to suggest 1600.now for a future update.

I'm a high school senior, and I built 1600.now because students need more realistic Digital SAT practice than they can usually get from a small set of official tools. The site is fully free and ad-free. It includes 7,600+ Digital SAT questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can use it in the browser without creating an account or paying.

Resource: https://1600.now

Thanks for considering it.

Luke Finigan

### Colleges of Distinction

Target: https://collegesofdistinction.com/contact-us/

Research note: Colleges of Distinction has college readiness and SAT/ACT resource content.

Subject:

Free ad-free Digital SAT prep resource for college readiness content

Message:

Hi,

I saw Colleges of Distinction's college readiness resources, including SAT and ACT prep content. I wanted to suggest a free Digital SAT resource for a future update.

The SAT has changed a lot since some older app-based resources were published, so I wanted to suggest a current Digital SAT option.

I'm a high school senior, and I built 1600.now after seeing how quickly serious SAT prep becomes expensive or limited. The site is fully free and ad-free. It includes 7,600+ Digital SAT questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can start in the browser without an account or payment.

Resource: https://1600.now

Thanks for considering it.

Luke Finigan

### CollegiateParent

Target: https://www.collegiateparent.com/contact/

Research note: CollegiateParent publishes parent-facing college prep resource articles, including test-prep app recommendations.

Subject:

Free ad-free Digital SAT prep resource for families

Message:

Hi,

I saw CollegiateParent's college prep app and resource content for families. I wanted to suggest 1600.now as a free SAT prep option that parents can share with high school students.

I'm a high school senior, and I built 1600.now after seeing how hard it is for students to get enough realistic SAT practice without paying. The site is fully free and ad-free. It includes 7,600+ Digital SAT questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can use it in the browser without an account or payment.

Resource: https://1600.now

Thanks for considering it.

Luke Finigan

### Lumiere Education

Target: contact@lumiere.education

Research note: Lumiere Education publishes student resource articles, including free SAT course lists.

Subject:

Free ad-free Digital SAT practice resource for your SAT prep list

Message:

Hi,

I saw Lumiere Education's list of free SAT prep courses and wanted to suggest one more free resource for a future update.

I'm a high school senior, and I built 1600.now to give students realistic Digital SAT practice without a paywall. The site is fully free and ad-free. It includes 7,600+ Digital SAT questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can start in the browser without an account or payment.

Resource: https://1600.now

Thanks for considering it.

Luke Finigan

## International and advising resources

### AMIDEAST

Target: dsaleh@amideast.org; optional cc inquiries@amideast.org and beirut@educationusa.org

Research note: AMIDEAST supports education advising and test preparation for students applying to U.S. colleges.

Subject:

Free ad-free Digital SAT prep resource for advising students

Message:

Hello,

I saw that AMIDEAST supports students preparing for U.S. college admissions and standardized tests. I wanted to suggest a free Digital SAT practice resource that may be useful for advising students.

I'm a high school senior, and I built 1600.now to make realistic SAT practice easier to access. It is fully free and ad-free, with 7,600+ Digital SAT questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can use it in the browser without payment.

Resource: https://1600.now

Thank you for considering it.

Luke Finigan

### EducationUSA Tashkent

Target: https://educationusa.state.gov/email/node/427/field_center_email_forwarder

Research note: EducationUSA Tashkent supports students applying to U.S. colleges and references test preparation materials.

Subject:

Free ad-free Digital SAT prep resource for EducationUSA students

Message:

Hello,

I saw that EducationUSA Tashkent supports students preparing for U.S. college admissions and standardized tests. I wanted to suggest a free Digital SAT resource for students who are preparing for the SAT.

I'm a high school senior, and I built 1600.now to make realistic SAT practice easier to access. It is fully free and ad-free, with 7,600+ Digital SAT questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can use it in the browser without payment.

Resource: https://1600.now

Thank you for considering it.

Luke Finigan

### InternationalStudent.com

Target: https://www.internationalstudent.com/contact/

Research note: InternationalStudent.com publishes SAT guide and prep content for international students applying to U.S. colleges.

Subject:

Free ad-free Digital SAT prep resource for international students

Message:

Hello,

I saw InternationalStudent.com's SAT guide and prep content for students applying to U.S. colleges. I wanted to suggest one more free Digital SAT resource.

I'm a high school senior, and I built 1600.now to make realistic SAT practice easier to access. It is fully free and ad-free, with 7,600+ Digital SAT questions, explanations for every answer, adaptive practice modules, a score calculator, and vocabulary practice. Students can use it in the browser without payment.

Resource: https://1600.now

Thank you for considering it.

Luke Finigan
