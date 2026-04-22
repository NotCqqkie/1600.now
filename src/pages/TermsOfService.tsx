import { Link } from "react-router-dom";

import { PageSeo, buildBreadcrumbJsonLd } from "@/components/seo/PageSeo";

const contactEmail = "questions@1600.now";

const sections = [
  {
    title: "1. Acceptance of Terms",
    body: [
      "These Terms of Service (\"Terms\") form a binding agreement between you (\"you\" or \"user\") and 1600.now (\"we,\" \"us,\" or \"our\") and govern your access to and use of the website located at 1600.now and any related subdomains, applications, APIs, content, and features (collectively, the \"Service\").",
      "By creating an account, signing in, or otherwise accessing or using the Service, you acknowledge that you have read, understood, and agreed to be bound by these Terms and by our Privacy Policy, which is incorporated by reference. If you do not agree, you must not access or use the Service.",
      "If you accept these Terms on behalf of a school, organization, parent, guardian, tutor, or other person, you represent and warrant that you have authority to bind that person or entity, and references to \"you\" include both you and that person or entity.",
    ],
  },
  {
    title: "2. Eligibility",
    body: [
      "You must be at least 13 years old to create an account or use the Service. If you are between 13 and 18 (or the age of majority where you live), you may use the Service only with the consent and supervision of a parent or legal guardian who agrees to these Terms on your behalf.",
      "You may not use the Service if you are barred from doing so under applicable law, if your account has been previously suspended or terminated, or if you are located in a jurisdiction where use of the Service is prohibited.",
      "The Service is not intended for, and we do not knowingly collect personal information from, children under 13. See the Privacy Policy for additional details about how we handle children's information.",
    ],
  },
  {
    title: "3. Description of the Service",
    body: [
      "1600.now is an independent SAT preparation platform that provides study tools and educational content, including a question bank, full-length and modular practice tests, AI-generated step-by-step explanations, an embedded Desmos calculator, vocabulary review, score calculators and projections, performance analytics, personalization, and progress tracking.",
      "Some features require a free account. We may add, remove, modify, suspend, throttle, or discontinue any feature, content set, integration, or portion of the Service at any time, with or without notice. We are not obligated to preserve any specific feature, question, explanation, dataset, score estimate, saved note, or workflow indefinitely.",
      "The Service relies on third-party providers, including Google Firebase (authentication, Cloud Firestore, Firebase Hosting, and Google Analytics for Firebase), the Desmos graphing calculator, and large language model APIs used to pre-generate explanations. Availability of the Service may be affected by the availability of those providers.",
    ],
  },
  {
    title: "4. Independence and No Affiliation",
    body: [
      "1600.now is an independent educational platform. We are not affiliated with, sponsored by, endorsed by, licensed by, or otherwise connected to the College Board, ETS, Khan Academy, Bluebook, the Desmos Studio team (beyond use of the publicly available embeddable calculator), or any college, university, or scholarship program.",
      "\"SAT,\" \"PSAT,\" \"Bluebook,\" \"College Board,\" and related marks are trademarks of their respective owners. Any references to such marks are made for the limited purpose of identifying the test or program for which we provide preparation materials and do not imply any endorsement, partnership, or affiliation.",
      "Practice questions, modules, score conversions, score projections, AI-generated explanations, recommendations, and analytics are provided for study purposes only. They are estimates and predictions, not guarantees of any actual SAT score, admissions outcome, scholarship outcome, placement decision, or other academic result.",
    ],
  },
  {
    title: "5. Accounts, Authentication, and Security",
    body: [
      "To use account-gated features (such as cross-device progress sync, saved notes, and personalized analytics), you must create an account using an email address and password or by signing in with Google through Firebase Authentication. You agree to provide accurate, current, and complete information and to keep that information up to date.",
      "You are responsible for safeguarding your account credentials, for any session tokens stored on your devices, and for all activity that occurs under your account, whether or not authorized by you. You agree not to share your credentials, allow others to use your account, or use someone else's account without permission.",
      "You must promptly notify us at the contact email below if you suspect unauthorized access to your account or any other security incident. We are not liable for losses caused by unauthorized use of your account that results from your failure to maintain credential security.",
      "We may, at our sole discretion and without prior notice, suspend, restrict, or terminate your account or access to the Service if we believe you have violated these Terms, created a security or legal risk, abused the Service, harmed other users, or used the Service in a manner inconsistent with its intended educational purpose.",
    ],
  },
  {
    title: "6. Acceptable Use",
    body: [
      "You agree to use the Service only for lawful, personal, non-commercial educational purposes and in accordance with these Terms. You agree not to, and not to attempt to:",
      "(a) access, tamper with, or use non-public areas of the Service, our systems, or the technical delivery systems of our providers; (b) probe, scan, or test the vulnerability of any system or network, or breach or circumvent any security or authentication measures; (c) decompile, disassemble, reverse engineer, or otherwise attempt to derive source code, models, prompts, or underlying ideas from the Service, except to the extent applicable law permits despite this restriction;",
      "(d) scrape, crawl, harvest, mirror, frame, deep-link, or otherwise extract or copy questions, explanations, vocabulary lists, datasets, analytics, or other Service content in bulk or in a manner that exceeds normal individual study use, whether by manual or automated means (including bots, agents, scripts, headless browsers, or AI training pipelines); (e) use any Service content to train, fine-tune, evaluate, or augment any machine learning model, dataset, or AI system without our express written permission;",
      "(f) interfere with, disrupt, overload, or impair the Service or any servers, networks, or third-party providers connected to the Service, or otherwise circumvent rate limits, quotas, paywalls, geographic restrictions, or device restrictions; (g) introduce viruses, worms, malware, or any other malicious or technologically harmful code; (h) impersonate any person or entity, misrepresent your identity, or falsely state or otherwise misrepresent your affiliation with a person or entity;",
      "(i) use the Service to transmit, upload, or otherwise make available content that is unlawful, infringing, defamatory, harassing, threatening, hateful, abusive, sexually explicit, deceptive, or that violates the privacy or rights of any third party; (j) use the Service in connection with cheating, plagiarism, score manipulation, or any conduct that violates the rules of the College Board, the SAT, or any other testing authority, school, or institution; (k) resell, sublicense, lease, rent, distribute, or otherwise commercially exploit the Service or any portion of it.",
    ],
  },
  {
    title: "7. Intellectual Property",
    body: [
      "The Service, including all software, code, designs, layouts, user interfaces, databases, question organization, taxonomies, AI-generated explanations, vocabulary curation, score conversion logic, copy text, audio, images, logos, and other materials made available through the Service (collectively, the \"Service Materials\"), is owned by 1600.now or its licensors and is protected by copyright, trademark, trade secret, and other intellectual property and proprietary rights laws.",
      "Subject to your compliance with these Terms, we grant you a limited, personal, revocable, non-exclusive, non-transferable, non-sublicensable license to access and use the Service and Service Materials solely for your own individual, non-commercial SAT preparation. All rights not expressly granted are reserved.",
      "Some content displayed in the Service (such as questions adapted from publicly released practice materials) may be the property of third parties and is used for educational and commentary purposes. Such third-party content remains the property of its respective owners.",
      "\"1600.now\" and our logos are our trademarks. You may not use them without our prior written permission. Other names, logos, and marks appearing in the Service are the property of their respective owners.",
    ],
  },
  {
    title: "8. User-Generated Content",
    body: [
      "The Service may allow you to submit, save, or upload content, including practice answers, written notes, passage annotations, highlights, score-calculator inputs, support messages, and account preferences (\"User Content\"). You retain all rights you have in your User Content.",
      "By submitting User Content, you grant 1600.now a worldwide, non-exclusive, royalty-free, transferable, sublicensable license to host, store, reproduce, transmit, display, modify (e.g., reformatting for display), and otherwise use your User Content for the limited purposes of operating, securing, maintaining, debugging, supporting, and improving the Service for you, and to comply with legal obligations. We will not publicly display your personal notes or answers to other users without your consent.",
      "You represent and warrant that you own or have all necessary rights to your User Content, that it does not infringe or violate any third-party rights, and that it complies with these Terms and applicable law. You are solely responsible for your User Content and the consequences of submitting it.",
      "We may, but are not required to, review, remove, or refuse to display User Content that we believe violates these Terms or applicable law. We do not endorse any User Content and are not responsible for it.",
    ],
  },
  {
    title: "9. AI-Generated Explanations and Educational Content",
    body: [
      "Step-by-step explanations, hints, and certain other educational outputs in the Service are generated, in whole or in part, by automated systems and large language models. While we make significant efforts to review, refine, and pre-generate high-quality explanations, AI-generated content can contain errors, omissions, factual inaccuracies, mathematical mistakes, hallucinated references, or content that is incomplete, outdated, or otherwise unreliable.",
      "You should treat AI-generated explanations as study aids only and independently verify any answer, formula, score conversion, or recommendation before relying on it for high-stakes decisions. We make no representation or warranty that any AI-generated content is accurate, complete, current, or fit for any particular purpose.",
      "Score projections, percentile estimates, and adaptive recommendations are statistical estimates based on your activity within the Service and on publicly available scoring information. They do not predict your actual SAT score and are not endorsed by the College Board.",
    ],
  },
  {
    title: "10. Third-Party Services, Links, and Integrations",
    body: [
      "The Service relies on, integrates with, and may link to third-party products and services, including but not limited to: Google Firebase (Authentication, Cloud Firestore, Firebase Hosting, Google Analytics for Firebase) for authentication, data storage, hosting, and analytics; Google Sign-In for federated login; the Desmos graphing calculator embedded for math practice; and large language model providers (such as OpenRouter and the underlying model providers it routes to) used to pre-generate explanations.",
      "Your use of those third-party services is governed by their own terms and privacy policies, not these Terms. We are not responsible for the availability, content, accuracy, security, privacy practices, or any other aspect of any third-party product, service, or website, and we do not endorse them.",
      "If a third-party service becomes unavailable, changes its terms, or modifies its functionality, the Service or specific features may be impacted, and we may modify or remove affected features without liability.",
    ],
  },
  {
    title: "11. Fees, Subscriptions, and Refunds",
    body: [
      "The Service is currently provided free of charge. We may, in the future, introduce paid features, subscriptions, or premium tiers. If we do, the applicable pricing, billing cycle, renewal behavior, taxes, cancellation rights, and refund policy will be presented before you complete a purchase, and those terms will form part of these Terms with respect to that purchase.",
      "Unless otherwise required by applicable law or expressly stated at the point of purchase, fees are non-refundable, and partial-period refunds are not provided. You authorize us and our payment processors to charge your selected payment method for all applicable fees.",
      "If we offer free trials or promotional pricing, the trial or promotional terms will be disclosed at sign-up. Unless cancelled before the trial ends, you may be automatically charged the then-current subscription rate.",
    ],
  },
  {
    title: "12. Feedback",
    body: [
      "If you submit suggestions, feedback, ideas, bug reports, or feature requests (collectively, \"Feedback\"), you grant us a perpetual, irrevocable, worldwide, royalty-free, fully sublicensable license to use, modify, and incorporate the Feedback into the Service or any other product or service without obligation, attribution, or compensation to you.",
    ],
  },
  {
    title: "13. Termination and Account Deletion",
    body: [
      "You may stop using the Service or delete your account at any time by emailing us at the contact address below. Deletion will remove your account and associated personal information from our active production systems within a reasonable period, subject to the retention practices described in our Privacy Policy (including residual copies in routine backups, security logs, and aggregated or de-identified analytics).",
      "We may suspend, restrict, or terminate your access to the Service or your account, in whole or in part, at any time, with or without notice, if (a) you violate these Terms, (b) we reasonably believe your conduct exposes us, our users, or third parties to legal, security, reputational, or financial risk, (c) we are required to do so by law or legal process, or (d) we discontinue the Service.",
      "Upon termination, your right to access and use the Service immediately ceases, and we may delete your account and User Content. Sections that by their nature should survive termination will survive, including without limitation Sections 6–8, 11–12, and 14–20.",
    ],
  },
  {
    title: "14. Disclaimers",
    body: [
      "THE SERVICE AND ALL CONTENT, INCLUDING WITHOUT LIMITATION QUESTIONS, EXPLANATIONS, SCORE PROJECTIONS, ANALYTICS, AND ANY AI-GENERATED OUTPUT, ARE PROVIDED \"AS IS\" AND \"AS AVAILABLE,\" WITH ALL FAULTS AND WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY.",
      "TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, 1600.NOW AND ITS OWNERS, EMPLOYEES, CONTRACTORS, AGENTS, LICENSORS, AND PROVIDERS DISCLAIM ALL WARRANTIES, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, ACCURACY, AVAILABILITY, QUIET ENJOYMENT, AND ANY WARRANTIES ARISING OUT OF COURSE OF DEALING, COURSE OF PERFORMANCE, OR TRADE USAGE.",
      "WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE; THAT DEFECTS WILL BE CORRECTED; OR THAT THE SERVICE OR THE SERVERS THAT MAKE IT AVAILABLE ARE FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS. WE DO NOT WARRANT THAT ANY SCORE ESTIMATE, EXPLANATION, RECOMMENDATION, OR OTHER OUTPUT IS ACCURATE, COMPLETE, OR RELIABLE, OR THAT YOUR USE OF THE SERVICE WILL RESULT IN ANY PARTICULAR EDUCATIONAL OUTCOME.",
      "Some jurisdictions do not allow the exclusion of certain warranties; in those jurisdictions, the above exclusions apply to the maximum extent permitted by law.",
    ],
  },
  {
    title: "15. Limitation of Liability",
    body: [
      "TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT WILL 1600.NOW OR ITS OWNERS, EMPLOYEES, CONTRACTORS, AGENTS, LICENSORS, OR PROVIDERS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION DAMAGES FOR LOST PROFITS, LOST REVENUE, LOST SAVINGS, LOST OPPORTUNITY, LOST DATA, LOSS OF GOODWILL, COST OF SUBSTITUTE SERVICES, BUSINESS INTERRUPTION, EXAM-RELATED LOSSES, OR LOSS OF ADMISSIONS OR SCHOLARSHIP OUTCOMES, ARISING OUT OF OR RELATING TO THESE TERMS OR YOUR USE OF (OR INABILITY TO USE) THE SERVICE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES AND EVEN IF A REMEDY FAILS OF ITS ESSENTIAL PURPOSE.",
      "TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, OUR TOTAL CUMULATIVE LIABILITY FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICE WILL NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU PAID TO US TO USE THE SERVICE IN THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO LIABILITY OR (B) ONE HUNDRED U.S. DOLLARS (US$100).",
      "These limitations apply regardless of the legal theory on which the claim is based (contract, tort, statute, strict liability, or otherwise) and form an essential basis of the bargain between you and us. Some jurisdictions do not allow the exclusion or limitation of certain damages; in those jurisdictions, our liability is limited to the maximum extent permitted by law.",
    ],
  },
  {
    title: "16. Indemnification",
    body: [
      "You agree to defend, indemnify, and hold harmless 1600.now and its owners, employees, contractors, agents, licensors, and providers from and against any and all claims, demands, actions, liabilities, losses, damages, judgments, settlements, costs, and expenses (including reasonable attorneys' fees) arising out of or relating to (a) your access to or use of the Service, (b) your User Content, (c) your violation of these Terms or any applicable law, (d) your violation of any third-party right (including intellectual property, privacy, or publicity rights), or (e) any dispute between you and another user or third party.",
      "We reserve the right, at your expense, to assume the exclusive defense and control of any matter for which you are required to indemnify us, in which case you agree to cooperate with our defense.",
    ],
  },
  {
    title: "17. DMCA / Copyright Complaints",
    body: [
      "If you believe that content available through the Service infringes your copyright, you may submit a notice under the Digital Millennium Copyright Act (\"DMCA\") to the contact email below. Your notice must include: (a) a physical or electronic signature of the copyright owner or authorized agent; (b) identification of the copyrighted work claimed to be infringed; (c) identification of the material claimed to be infringing and information sufficient to allow us to locate it; (d) your contact information; (e) a statement that you have a good-faith belief that the use is not authorized by the copyright owner, its agent, or the law; and (f) a statement, made under penalty of perjury, that the information in the notice is accurate and that you are the owner or are authorized to act on behalf of the owner.",
      "We may, in appropriate circumstances and in our discretion, remove or disable access to material that is the subject of valid DMCA notices and terminate the accounts of repeat infringers.",
    ],
  },
  {
    title: "18. Modifications to the Terms",
    body: [
      "We may update these Terms from time to time. When we make material changes, we will revise the \"Effective date\" above and may provide additional notice through the Service or by email. Non-material changes (such as clarifications, formatting fixes, and corrections) may be made without prior notice.",
      "Your continued access to or use of the Service after the Effective date of an update constitutes your acceptance of the updated Terms. If you do not agree with the updated Terms, you must stop using the Service and may delete your account.",
    ],
  },
  {
    title: "19. Governing Law and Dispute Resolution",
    body: [
      "These Terms and any dispute arising out of or related to them or the Service are governed by the laws of the United States and the State of New York, without regard to its conflict-of-laws provisions, except where applicable mandatory consumer protection laws of your place of residence require otherwise.",
      "Subject to the next paragraph, you and we agree that any dispute, claim, or controversy arising out of or relating to these Terms or the Service will be brought exclusively in the state or federal courts located in New York County, New York, and you and we consent to the personal jurisdiction of those courts. You agree to waive any objection based on lack of personal jurisdiction, improper venue, or inconvenient forum.",
      "To the fullest extent permitted by law, you and we agree that any claim must be brought in your or our individual capacity and not as a plaintiff or class member in any purported class, collective, or representative proceeding, and that any claim must be filed within one (1) year after the cause of action accrues or be permanently barred.",
      "Nothing in this Section prevents either party from seeking injunctive or other equitable relief in any court of competent jurisdiction to protect intellectual property rights or confidential information.",
    ],
  },
  {
    title: "20. Miscellaneous",
    body: [
      "These Terms, together with the Privacy Policy and any additional terms presented at the point of purchase or use of a specific feature, constitute the entire agreement between you and 1600.now regarding the Service and supersede all prior or contemporaneous agreements and communications.",
      "If any provision of these Terms is held to be invalid, illegal, or unenforceable, the remaining provisions will remain in full force and effect, and the invalid provision will be modified only to the extent necessary to make it enforceable.",
      "Our failure to enforce any right or provision will not be deemed a waiver of that right or provision. You may not assign or transfer these Terms or any rights or obligations under them without our prior written consent. We may assign these Terms in connection with a merger, acquisition, financing, sale of assets, or by operation of law. Any purported assignment in violation of this Section is void.",
      "The Service is controlled and operated from the United States. We make no representation that the Service is appropriate or available for use in other locations. If you access the Service from outside the United States, you do so at your own initiative and are responsible for compliance with applicable local laws, including export controls and sanctions.",
      "No agency, partnership, joint venture, employment, or franchise relationship is created by these Terms. Headings are for convenience only and do not affect interpretation.",
    ],
  },
  {
    title: "21. Contact",
    body: [
      `Questions, notices, or requests under these Terms (including DMCA notices, account deletion requests, and security reports) can be sent to ${contactEmail}.`,
    ],
  },
];

const TermsOfService = () => {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageSeo
        id="terms-of-service"
        title="Terms of Service | 1600.now"
        description="Terms of Service for using 1600.now SAT prep tools, practice modules, score calculator, and question bank."
        jsonLd={[
          buildBreadcrumbJsonLd([
            { name: "Home", url: "https://1600.now/" },
            { name: "Terms of Service", url: "https://1600.now/terms" },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "Terms of Service",
            url: "https://1600.now/terms",
          },
        ]}
      />

      <header className="mb-10">
        <p className="text-sm font-medium text-muted-foreground">
          Effective date: April 20, 2026
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">
          Terms of Service
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          These Terms of Service govern your access to and use of 1600.now,
          including our SAT prep tools, practice modules, question bank, score
          calculator, explanations, analytics, and related services.
        </p>
      </header>

      <div className="space-y-8">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-2xl font-semibold tracking-tight">
              {section.title}
            </h2>
            <div className="mt-3 space-y-3 text-muted-foreground">
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-12 rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
        <p>
          Contact us at{" "}
          <a className="font-medium text-foreground underline" href={`mailto:${contactEmail}`}>
            {contactEmail}
          </a>
          .
        </p>
        <p className="mt-2">
          Review the{" "}
          <Link className="font-medium text-foreground underline" to="/privacy">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
};

export default TermsOfService;
