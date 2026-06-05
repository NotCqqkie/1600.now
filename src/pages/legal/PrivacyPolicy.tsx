import { Link } from "react-router-dom";

import { PageSeo, buildBreadcrumbJsonLd } from "@/components/seo/PageSeo";

const contactEmail = "info@1600.now";

const sections = [
  {
    title: "1. Introduction",
    body: [
      "This Privacy Policy explains how 1600.now (\"we,\" \"us,\" or \"our\") collects, uses, discloses, and protects information about you when you visit our website at 1600.now or otherwise interact with our SAT preparation services, including the question bank, practice modules, score calculator, vocabulary review, step-by-step explanations, embedded Desmos calculator, and related tools (collectively, the \"Service\").",
      "By using the Service, you acknowledge that your information will be handled as described in this Privacy Policy. This policy is incorporated into and governed by our Terms of Service. Capitalized terms used but not defined here have the meanings given in the Terms of Service.",
      "We may update this Privacy Policy from time to time. The \"Effective date\" above reflects the most recent version. Material changes will be communicated through the Service or by email where appropriate.",
    ],
  },
  {
    title: "2. Information We Collect",
    body: [
      "We collect the categories of information described below. Some categories are required to provide the Service; others are collected only if you choose to provide them or use particular features.",
      "Account and authentication information: When you create an account, we collect your email address and either a hashed password (when you sign up with email and password) or a federated identifier from Google Sign-In. If you use Google Sign-In, Google may share your email address, display name, profile picture URL, Google account ID, and email-verified status with us, as governed by Google's privacy policy. We also generate and store a Firebase user ID (\"UID\") that uniquely identifies your account.",
      "Learning and activity data: As you use the Service, we collect information about your activity, including: questions viewed, attempted, and answered; selected answer choices; correct/incorrect outcomes; time spent on questions and modules; module and practice-test progress and results; vocabulary review status; score calculator inputs and computed projections; saved notes and passage annotations; preferences (such as theme, calculator settings, bank filters); and personalization signals such as performance trends across domains and skills.",
      "Device, browser, and technical information: We automatically collect technical information such as IP address, device type and model, operating system and version, browser type and version, screen size, language, referring URLs, pages viewed, links clicked, session timestamps, approximate location derived from IP, error and diagnostic logs, and similar telemetry.",
      "Analytics and usage events: Through Google Analytics for Firebase, we collect events such as page views, login and signup events, and feature interactions. These events may be associated with your Firebase UID when you are signed in, and otherwise with a pseudonymous Firebase installation/app instance ID.",
      "Communications: If you contact us by email or submit feedback or support requests, we collect the contents of those communications, your email address, and any attachments or other information you choose to provide.",
      "We do not knowingly collect government identifiers (such as Social Security numbers), payment card data (the Service is currently free), precise GPS location, biometric identifiers, or sensitive categories of personal information beyond what is described above.",
    ],
  },
  {
    title: "3. How We Use Information",
    body: [
      "We use the information we collect to:",
      "(a) provide, operate, maintain, and secure the Service, including authenticating you, syncing your progress across devices, displaying your analytics, saving your notes and answers, generating personalized recommendations, and serving step-by-step explanations; (b) develop, debug, and improve the Service, fix bugs, evaluate feature performance, conduct internal research, and add new content and functionality;",
      "(c) communicate with you about the Service, respond to support requests, send transactional messages (such as password resets, account notifications, and security alerts), and, where permitted, send occasional product updates; (d) detect, investigate, and prevent fraud, abuse, automated scraping, security incidents, and violations of our Terms of Service or applicable law;",
      "(e) comply with our legal obligations, enforce our Terms of Service, defend against legal claims, and protect our rights and the rights, safety, and property of our users and third parties; and (f) create aggregated or de-identified information that does not identify any individual and use it for any lawful purpose, including improving SAT preparation content and benchmarking feature performance.",
      "Legal bases for users in the European Economic Area, the United Kingdom, and Switzerland: We process personal information based on (i) the performance of our contract with you (to provide the Service), (ii) our legitimate interests (such as securing the Service, preventing abuse, and improving features) where those interests are not overridden by your rights, (iii) your consent (where required, for example for certain analytics or communications), and (iv) compliance with legal obligations.",
    ],
  },
  {
    title: "4. Cookies, Local Storage, and Similar Technologies",
    body: [
      "We and our service providers use cookies, browser local storage, session storage, IndexedDB, and similar technologies to operate the Service. These technologies are used for the purposes described below.",
      "Strictly necessary: keeping you signed in via Firebase Authentication session tokens, preserving in-progress practice modules and tests so refreshes do not lose work, remembering your bank-filter selections and navigation state, protecting against CSRF and abuse, and enabling chunk-load recovery when our deployed assets change.",
      "Preferences: remembering your theme (light/dark), Desmos calculator settings, vocabulary progress, accessibility choices, and similar preferences so your experience is consistent across visits and devices.",
      "Analytics: Google Analytics for Firebase uses identifiers and similar technologies to measure usage, identify the most-used features, and understand performance trends. Analytics data may be associated with your Firebase UID while you are signed in.",
      "You can clear or block cookies and local storage through your browser settings, including by clearing site data for 1600.now. Doing so will sign you out, may erase locally stored progress that has not yet synced to your account, and may cause certain features (such as in-progress practice modules and saved settings) to stop working correctly.",
      "We do not currently respond to \"Do Not Track\" browser signals because there is no industry-wide standard for how to interpret them. We will continue to monitor developments in this area.",
    ],
  },
  {
    title: "5. How We Share Information",
    body: [
      "We do not sell or rent personal information for monetary consideration. We do not share personal information for cross-context behavioral advertising. We share personal information only as described below.",
      "Service providers and subprocessors: We share information with vendors that help us operate the Service under contractual obligations to use the information only on our behalf. Our primary subprocessors are: Google LLC (Firebase Authentication, Cloud Firestore, Firebase Hosting, Google Analytics for Firebase, and Google Sign-In); Desmos (the embedded graphing calculator, loaded from Desmos's servers); and explanation-generation providers used to prepare study content. Your interactions with the Service are not used to train third-party models without our authorization, although content sent to generation providers is subject to those providers' policies.",
      "Compliance and protection: We may disclose information when we believe in good faith that disclosure is necessary to (a) comply with applicable law, regulation, legal process, or governmental request; (b) enforce our Terms of Service or other agreements; (c) detect, prevent, or otherwise address fraud, security, or technical issues; or (d) protect against harm to the rights, property, or safety of 1600.now, our users, or others.",
      "Business transfers: If we are involved in a merger, acquisition, financing, reorganization, bankruptcy, sale of all or part of our assets, or similar transaction, information may be transferred as part of that transaction. We will require the recipient to honor this Privacy Policy or provide notice of any material changes.",
      "With your consent or at your direction: We may share information for any other purpose disclosed to you with your consent.",
    ],
  },
  {
    title: "6. Data Storage, Location, and International Transfers",
    body: [
      "Your account information and learning data are stored in Google Cloud Firestore and other Firebase services operated by Google LLC. Data may be processed in the United States or in other countries where Google or our other service providers operate.",
      "If you access the Service from outside the United States, your information will be transferred to and processed in the United States and other locations where our service providers operate, where data protection laws may differ from those in your country. Where required by law, we rely on appropriate safeguards (such as the European Commission's Standard Contractual Clauses) for such transfers.",
    ],
  },
  {
    title: "7. Data Retention",
    body: [
      "We retain personal information for as long as your account is active and as long as needed to provide the Service, comply with legal and tax obligations, resolve disputes, enforce our agreements, prevent fraud and abuse, and operate our business.",
      "When you delete your account or request deletion, we will delete or de-identify your personal information from our active production systems within a reasonable period (typically within 30 days), except where we are required or permitted by law to retain it. Residual copies may persist for a limited time in routine backups, security logs, and aggregated or de-identified records.",
      "Aggregated or de-identified information that cannot reasonably be used to identify you may be retained and used indefinitely.",
    ],
  },
  {
    title: "8. Your Choices and Privacy Rights",
    body: [
      "Account controls: You can update your display name, email address, and password through your account settings or by contacting us. You can sign out at any time, and you can clear locally stored data through your browser.",
      "Marketing communications: We currently send only transactional messages (such as password resets and security alerts). If we introduce promotional emails in the future, you will be able to opt out using the unsubscribe link in those messages.",
      "Account deletion: You can request deletion of your account and associated personal information by emailing us at the contact address below. We may need to verify your identity before acting on the request.",
      "Regional rights: Depending on where you live, you may have additional rights under applicable privacy law, including the right to (a) access the personal information we hold about you; (b) request correction of inaccurate or incomplete information; (c) request deletion or erasure; (d) object to or restrict certain processing; (e) request portability of certain information in a structured, machine-readable format; (f) withdraw consent where processing is based on consent; and (g) lodge a complaint with a supervisory authority.",
      "California residents: Under the California Consumer Privacy Act, as amended (\"CCPA/CPRA\"), you have rights to know, delete, correct, and limit the use and disclosure of personal information, and to not be discriminated against for exercising those rights. We do not sell personal information and do not share personal information for cross-context behavioral advertising. To exercise your rights, contact us using the email below.",
      "We will respond to verifiable consumer requests within the time required by applicable law. We may decline requests where an exception applies (for example, when retention is required to comply with law or to detect security incidents).",
    ],
  },
  {
    title: "9. Children's Privacy",
    body: [
      "The Service is intended for users age 13 and older. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child under 13 has provided us with personal information, please contact us at the email below and we will take steps to delete the information and the associated account.",
      "If you are between 13 and 18 (or the age of majority in your jurisdiction), you should use the Service only with the involvement of a parent or legal guardian who has agreed to our Terms of Service on your behalf.",
      "We do not direct the Service to children under 13 and do not knowingly engage in activities that would require compliance with the Children's Online Privacy Protection Act (\"COPPA\") for children under 13.",
    ],
  },
  {
    title: "10. Security",
    body: [
      "We use reasonable administrative, technical, and organizational safeguards designed to protect personal information against unauthorized access, alteration, disclosure, and destruction, including encryption in transit (HTTPS/TLS), access controls, Firestore security rules, authenticated database access, and audit logging through our hosting providers.",
      "No method of transmission over the internet or method of electronic storage is 100% secure, however, and we cannot guarantee absolute security. You are responsible for protecting your account credentials and for promptly notifying us of any suspected unauthorized access at the contact email below.",
    ],
  },
  {
    title: "11. Third-Party Links and Services",
    body: [
      "The Service may contain links to third-party websites, services, and resources that are not operated by us, and may embed third-party tools (such as the Desmos graphing calculator). This Privacy Policy does not apply to those third-party services, and we are not responsible for their content, privacy practices, or terms.",
      "We encourage you to review the privacy policies of any third-party service you interact with, including: Google's Privacy Policy (for Firebase, Google Analytics for Firebase, and Google Sign-In) and Desmos's Privacy Policy.",
    ],
  },
  {
    title: "12. Generated Content and Privacy",
    body: [
      "Step-by-step explanations and certain other content shown in the Service may be prepared with automated generation systems. Where such content is pre-generated server-side or at build time, we do not transmit your personal information to model providers as part of the request. Where any user-supplied content (such as a question or note) is sent to a model provider in connection with a feature, that content is processed by the provider under its own terms and privacy policies and used solely to generate the requested output for you.",
      "We do not use your personal information to train third-party models. We do not authorize model providers to use your personal information for their own purposes beyond providing the requested service to us.",
    ],
  },
  {
    title: "13. Changes to This Policy",
    body: [
      "We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors. When we make material changes, we will revise the \"Effective date\" above and may provide additional notice through the Service or by email. Your continued use of the Service after the update becomes effective constitutes your acceptance of the updated Privacy Policy.",
    ],
  },
  {
    title: "14. Contact Us",
    body: [
      `If you have questions, comments, or requests regarding this Privacy Policy or our privacy practices, including requests to exercise your privacy rights, contact us at ${contactEmail}. We may need to verify your identity before acting on certain requests.`,
    ],
  },
];

const PrivacyPolicy = () => {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageSeo
        id="privacy-policy"
        title="Privacy Policy | 1600.now"
        description="Privacy Policy for 1600.now, including what information is collected, how it is used, and how to contact us."
        jsonLd={[
          buildBreadcrumbJsonLd([
            { name: "Home", url: "https://1600.now/" },
            { name: "Privacy Policy", url: "https://1600.now/privacy" },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "Privacy Policy",
            url: "https://1600.now/privacy",
          },
        ]}
      />

      <header className="mb-10">
        <p className="text-sm font-medium text-muted-foreground">
          Effective date: April 20, 2026
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">
          Privacy Policy
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          This Privacy Policy explains how 1600.now collects, uses, shares, and
          protects information when you use our SAT prep website, tools,
          practice modules, question bank, score calculator, and related
          services.
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
          For account, privacy, or support questions, email{" "}
          <a className="font-medium text-foreground underline" href={`mailto:${contactEmail}`}>
            {contactEmail}
          </a>
          .
        </p>
        <p className="mt-2">
          Review the{" "}
          <Link className="font-medium text-foreground underline" to="/terms">
            Terms of Service
          </Link>
          .
        </p>
      </div>
    </main>
  );
};

export default PrivacyPolicy;
