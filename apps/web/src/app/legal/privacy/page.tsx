import type { Metadata } from "next";
import { LegalTOC } from "@/components/LegalTOC";
import { Section, SubSection } from "@/components/LegalSection";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

const toc = [
  { id: "info-collect", label: "Information We Collect" },
  { id: "info-use", label: "How We Use Your Information" },
  { id: "info-share", label: "How We Share Your Information" },
  { id: "info-retention", label: "Data Retention" },
  { id: "info-security", label: "Data Security" },
  { id: "info-cookies", label: "Cookies" },
  { id: "info-rights", label: "Your Rights" },
  { id: "info-transfers", label: "International Transfers" },
  { id: "info-children", label: "Children" },
  { id: "info-changes", label: "Changes to This Policy" },
  { id: "info-contact", label: "Contact Us" },
];

export default function PrivacyPage() {
  return (
    <>
      <h1 className="mb-2 text-3xl font-semibold tracking-tight text-neutral-900">
        Privacy Policy
      </h1>
      <p className="mb-12 text-sm text-neutral-400">Effective date: August 24, 2026</p>

      <div className="flex gap-12">
        {/* Content */}
        <article className="min-w-0 flex-1 space-y-12">
          <p className="text-[15px] leading-relaxed text-neutral-600">
            At Trell, we take your privacy seriously. This Privacy Policy explains what
            information we collect, how we use it, and what choices you have. By using the
            Service, you agree to the practices described here.
          </p>

          {/* 1 */}
          <Section id="info-collect" title="Information We Collect">
            <SubSection id="info-collect-provided" number="1.1" title="Information You Provide">
              <ul className="list-inside list-disc space-y-1 pl-1">
                <li>
                  <strong className="text-neutral-700">Account details</strong> — your name,
                  email address, and profile picture when you sign up (including via Google or
                  other OAuth providers).
                </li>
                <li>
                  <strong className="text-neutral-700">Project data</strong> — tasks, documents,
                  analytics configurations, team settings, and any content you create or upload
                  through Trell.
                </li>
                <li>
                  <strong className="text-neutral-700">Payment information</strong> — billing
                  details processed by our payment provider. We do not store full credit card
                  numbers.
                </li>
                <li>
                  <strong className="text-neutral-700">Communications</strong> — messages you
                  send to our support team or feedback you provide.
                </li>
              </ul>
            </SubSection>

            <SubSection id="info-collect-auto" number="1.2" title="Automatically Collected">
              <ul className="list-inside list-disc space-y-1 pl-1">
                <li>
                  <strong className="text-neutral-700">Usage data</strong> — pages viewed,
                  features used, actions taken, timestamps, and interaction patterns within the
                  Service.
                </li>
                <li>
                  <strong className="text-neutral-700">Device data</strong> — browser type and
                  version, operating system, screen resolution, and device type.
                </li>
                <li>
                  <strong className="text-neutral-700">Network data</strong> — IP address,
                  approximate geolocation (city/country level), and referring URLs.
                </li>
              </ul>
            </SubSection>

            <SubSection id="info-collect-third" number="1.3" title="From Third Parties">
              <ul className="list-inside list-disc space-y-1 pl-1">
                <li>
                  <strong className="text-neutral-700">OAuth providers</strong> — if you sign in
                  with Google, we receive your name, email, and profile picture as authorized by
                  you.
                </li>
                <li>
                  <strong className="text-neutral-700">Integrations</strong> — data from
                  connected services (e.g., GitHub, Slack) that you choose to link to Trell.
                </li>
              </ul>
            </SubSection>
          </Section>

          {/* 2 */}
          <Section id="info-use" title="How We Use Your Information">
            <ul className="list-inside list-disc space-y-1 pl-1">
              <li>
                <strong className="text-neutral-700">Provide the Service</strong> — to operate,
                maintain, and deliver the features you use.
              </li>
              <li>
                <strong className="text-neutral-700">Improve Trell</strong> — to understand how
                teams use the platform, identify bugs, and develop new features.
              </li>
              <li>
                <strong className="text-neutral-700">Communicate with you</strong> — to send
                account notifications, security alerts, billing notices, and product updates.
              </li>
              <li>
                <strong className="text-neutral-700">Security</strong> — to detect fraud, abuse,
                and unauthorized access, and to protect the integrity of the Service.
              </li>
              <li>
                <strong className="text-neutral-700">Legal compliance</strong> — to comply with
                applicable laws, regulations, and legal processes.
              </li>
            </ul>
          </Section>

          {/* 3 */}
          <Section id="info-share" title="How We Share Your Information">
            <p>
              We do not sell your personal information. We may share data in the following
              limited circumstances:
            </p>
            <ul className="list-inside list-disc space-y-1 pl-1">
              <li>
                <strong className="text-neutral-700">Service providers</strong> — trusted
                vendors who help us operate the Service (hosting, payments, analytics), bound
                by contractual obligations to protect your data.
              </li>
              <li>
                <strong className="text-neutral-700">Team members</strong> — information you
                share within your Trell projects is visible to other members of those
                projects.
              </li>
              <li>
                <strong className="text-neutral-700">Legal requirements</strong> — when required
                by law, subpoena, or government request, or to protect our rights, safety, or
                property.
              </li>
              <li>
                <strong className="text-neutral-700">Business transfers</strong> — in connection
                with a merger, acquisition, or sale of assets, with prior notice.
              </li>
            </ul>
          </Section>

          {/* 4 */}
          <Section id="info-retention" title="Data Retention">
            <p>
              We keep your personal information for as long as your account is active or as
              needed to provide the Service. After account deletion, we retain data for up to
              30 days to allow for recovery, then permanently delete it. Some information may
              be retained longer if required by law or for legitimate business purposes (e.g.,
              billing records).
            </p>
          </Section>

          {/* 5 */}
          <Section id="info-security" title="Data Security">
            <p>
              We use industry-standard measures to protect your data, including encryption in
              transit (TLS) and at rest, access controls, regular security audits, and
              infrastructure monitoring. While we take reasonable precautions, no method of
              transmission or storage is 100% secure.
            </p>
          </Section>

          {/* 6 */}
          <Section id="info-cookies" title="Cookies">
            <p>We use cookies and similar technologies for the following purposes:</p>
            <ul className="list-inside list-disc space-y-1 pl-1">
              <li>
                <strong className="text-neutral-700">Essential cookies</strong> — required for
                authentication, session management, and security.
              </li>
              <li>
                <strong className="text-neutral-700">Analytics cookies</strong> — help us
                understand how the Service is used and improve performance.
              </li>
              <li>
                <strong className="text-neutral-700">Preference cookies</strong> — remember your
                settings and display preferences.
              </li>
            </ul>
            <p>
              You can manage cookies through your browser settings. Disabling essential
              cookies may affect the functionality of the Service.
            </p>
          </Section>

          {/* 7 */}
          <Section id="info-rights" title="Your Rights">
            <p>
              Depending on your jurisdiction, you may have the following rights regarding your
              personal data:
            </p>
            <ul className="list-inside list-disc space-y-1 pl-1">
              <li>
                <strong className="text-neutral-700">Access</strong> — request a copy of the
                personal data we hold about you.
              </li>
              <li>
                <strong className="text-neutral-700">Correction</strong> — request correction of
                inaccurate or incomplete data.
              </li>
              <li>
                <strong className="text-neutral-700">Deletion</strong> — request deletion of
                your personal data.
              </li>
              <li>
                <strong className="text-neutral-700">Portability</strong> — receive your data in
                a structured, machine-readable format.
              </li>
              <li>
                <strong className="text-neutral-700">Objection / Restriction</strong> — object
                to or restrict certain processing of your data.
              </li>
            </ul>
            <p>
              To exercise any of these rights, contact us at{" "}
              <a
                href="mailto:privacy@trell.dev"
                className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
              >
                privacy@trell.dev
              </a>
              . We will respond within 30 days.
            </p>
          </Section>

          {/* 8 */}
          <Section id="info-transfers" title="International Transfers">
            <p>
              Trell is based in the United States. If you are accessing the Service from
              outside the U.S., your data may be transferred to and processed in the U.S. or
              other countries where our service providers operate. We ensure appropriate
              safeguards are in place for international transfers.
            </p>
          </Section>

          {/* 9 */}
          <Section id="info-children" title="Children">
            <p>
              The Service is not intended for individuals under 16. We do not knowingly
              collect personal information from children. If we learn that we have collected
              data from a child under 16, we will delete it promptly.
            </p>
          </Section>

          {/* 10 */}
          <Section id="info-changes" title="Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. If we make material
              changes, we will notify you via email or through the Service at least 30 days
              before the changes take effect. The &quot;Effective date&quot; at the top
              indicates when this policy was last updated.
            </p>
          </Section>

          {/* 11 */}
          <Section id="info-contact" title="Contact Us">
            <p>
              Questions or concerns about this Privacy Policy? Reach out at{" "}
              <a
                href="mailto:privacy@trell.dev"
                className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
              >
                privacy@trell.dev
              </a>
              .
            </p>
          </Section>
        </article>

        {/* TOC */}
        <LegalTOC items={toc} />
      </div>
    </>
  );
}
