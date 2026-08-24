import type { Metadata } from "next";
import { LegalTOC } from "@/components/LegalTOC";
import { Section, SubSection } from "@/components/LegalSection";

export const metadata: Metadata = {
  title: "Terms of Service",
};

const toc = [
  { id: "services", label: "The Trell Services" },
  { id: "data", label: "Your Data" },
  { id: "billing", label: "Fees and Billing" },
  { id: "termination", label: "Termination" },
  { id: "changes", label: "Changes to These Terms" },
  { id: "warranties", label: "Warranties" },
];

export default function TermsPage() {
  return (
    <>
      <h1 className="mb-2 text-3xl font-semibold tracking-tight text-neutral-900">
        Terms of Service
      </h1>
      <p className="mb-12 text-sm text-neutral-400">Effective date: August 24, 2026</p>

      <div className="flex gap-12">
        {/* Content */}
        <article className="min-w-0 flex-1 space-y-12">
          <p className="text-[15px] leading-relaxed text-neutral-600">
            Subject to these Terms of Service (this &quot;Agreement&quot;), Trell &quot;we,&quot;
            &quot;us,&quot; or &quot;our&quot;) provides access to our cloud-based platform
            (the &quot;Platform&quot;) and related services (collectively, the
            &quot;Service&quot;) to you or the entity you represent (&quot;you,&quot;
            &quot;Client,&quot; or &quot;User&quot;). By registering for or using the Service,
            you agree to be bound by this Agreement. If you do not agree, do not use the
            Service.
          </p>
          <p className="text-[15px] leading-relaxed text-neutral-600">
            If you are entering into this Agreement on behalf of a company or other legal
            entity, you represent that you have the authority to bind that entity to this
            Agreement. If you do not have that authority, you must not accept this Agreement.
          </p>

          {/* 1 */}
          <Section id="services" title="The Trell Services">
            <SubSection id="services-description" number="1.1" title="Description of Service">
              <p>
                Trell is a project analytics and team management platform that helps teams
                track, measure, and improve their work. The Platform provides tools for
                project tracking, analytics dashboards, team collaboration, and performance
                monitoring.
              </p>
              <p>
                The Platform also enables integrations with third-party services, including
                version control systems, communication tools, and analytics providers, to
                give your team a unified view of project performance across tools.
              </p>
              <p>
                We reserve the right to modify, update, or discontinue the Service (or any
                part thereof) at any time. We will provide reasonable notice of any material
                changes to the Service.
              </p>
            </SubSection>

            <SubSection id="services-integrations" number="1.2" title="Integrations">
              <p>
                Trell may connect with third-party platforms, including but not limited to
                version control systems, communication tools, and analytics providers. Your
                use of these integrations is subject to the terms and privacy policies of
                those third-party services.
              </p>
              <p>
                We are not responsible for the availability, accuracy, or practices of
                third-party services. You grant us permission to access and share data with
                these services as necessary to provide the integration.
              </p>
            </SubSection>

            <SubSection id="services-account" number="1.3" title="Account Access">
              <p>
                You must sign up for an account to use the Service. You are responsible for
                maintaining the confidentiality of your account credentials and for all
                activity that occurs under your account.
              </p>
              <p>
                You agree to immediately notify us of any unauthorized use of your account or
                any other breach of security. We will not be liable for any loss or damage
                arising from unauthorized use of your credentials.
              </p>
            </SubSection>

            <SubSection id="services-usage" number="1.4" title="Usage Limits">
              <p>
                Your use of the Service may be subject to usage limits, including but not
                limited to the number of projects, team members, or API calls. These limits
                vary based on your subscription plan.
              </p>
              <p>
                We reserve the right to enforce rate limits and usage quotas. If you exceed
                your plan&apos;s limits, we may throttle or temporarily suspend access until
                you upgrade or reduce usage.
              </p>
            </SubSection>

            <SubSection id="services-suspension" number="1.5" title="Service Suspension">
              <p>
                We may, at our sole discretion and without liability, suspend or restrict your
                access to the Service if:
              </p>
              <ul className="list-inside list-disc space-y-1 pl-1">
                <li>Scheduled maintenance or updates are required.</li>
                <li>You breach any provision of this Agreement.</li>
                <li>Your use poses a security risk to the Service or other users.</li>
                <li>We are required to do so by law or regulatory authority.</li>
              </ul>
            </SubSection>

            <SubSection id="services-fair-use" number="1.6" title="Fair Use">
              <p>
                You agree not to misuse the Service. You may not use the Service for any
                unlawful purpose, to interfere with its operation, or to attempt to access it
                using unauthorized methods. Prohibited activities include:
              </p>
              <ul className="list-inside list-disc space-y-1 pl-1">
                <li>Reverse engineering, decompiling, or disassembling any part of the Service.</li>
                <li>Using automated means (bots, scrapers) to access the Service.</li>
                <li>Reselling, sublicensing, or distributing the Service without authorization.</li>
                <li>Uploading malicious code or content that harms the Service or other users.</li>
              </ul>
            </SubSection>
          </Section>

          {/* 2 */}
          <Section id="data" title="Your Data">
            <SubSection id="data-privacy" number="2.1" title="Privacy Policy">
              <p>
                Your use of the Service is also governed by our{" "}
                <a
                  href="/legal/privacy"
                  className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
                >
                  Privacy Policy
                </a>
                , which is incorporated into this Agreement by reference.
              </p>
            </SubSection>

            <SubSection id="data-content" number="2.2" title="Your Content">
              <p>
                You retain ownership of any data, files, text, or other materials you upload,
                create, or share through the Service (&quot;Your Content&quot;). By using
                Trell, you grant us a limited, non-exclusive license to host, store, and
                display Your Content solely for the purpose of operating and improving the
                Service.
              </p>
              <p>
                We will never use Your Content for advertising, sell it to third parties, or
                use it to train AI models without your explicit consent. You are solely
                responsible for ensuring that Your Content complies with applicable laws and
                does not infringe the rights of third parties.
              </p>
            </SubSection>

            <SubSection id="data-security" number="2.3" title="Data Security">
              <p>
                We implement industry-standard security measures to protect Your Content,
                including encryption in transit (TLS) and at rest, access controls, regular
                security audits, and infrastructure monitoring.
              </p>
              <p>
                While we take reasonable precautions, no method of transmission or storage is
                100% secure. We cannot guarantee absolute security of Your Content.
              </p>
            </SubSection>
          </Section>

          {/* 3 */}
          <Section id="billing" title="Fees and Billing">
            <SubSection id="billing-fees" number="3.1" title="Fees for Services">
              <p>
                The Service is offered under both free and paid subscription plans. Fees for
                paid plans are described on our pricing page and in your account dashboard.
                All fees are non-refundable unless required by applicable law.
              </p>
              <p>
                We reserve the right to change pricing with 30 days&apos; notice. Continued
                use after a price change constitutes acceptance of the new pricing.
              </p>
            </SubSection>

            <SubSection id="billing-payment" number="3.2" title="Payment Processing">
              <p>
                Payments are processed by our third-party payment provider. We do not store
                full credit card numbers. You authorize us to charge your payment method on a
                recurring basis (monthly or annually) for the duration of your subscription.
              </p>
              <p>
                If your payment method fails, we will attempt to retry the charge. If payment
                continues to fail after a reasonable grace period, we may suspend your access
                to paid features.
              </p>
            </SubSection>

            <SubSection id="billing-taxes" number="3.3" title="Taxes">
              <p>
                Fees are exclusive of all taxes, levies, and duties. You are responsible for
                paying all applicable taxes associated with your use of the Service, except
                for taxes based on our net income.
              </p>
            </SubSection>
          </Section>

          {/* 4 */}
          <Section id="termination" title="Termination">
            <p>
              You may cancel your account at any time from your account settings. We may
              suspend or terminate your access if you violate this Agreement, with or without
              notice.
            </p>
            <p>
              Upon termination, your right to use the Service ceases immediately. We will
              make your data available for export for 30 days after termination, after which
              it may be permanently deleted. Sections that by their nature should survive
              termination will survive, including ownership provisions, warranty disclaimers,
              and limitation of liability.
            </p>
          </Section>

          {/* 5 */}
          <Section id="changes" title="Changes to These Terms">
            <p>
              We reserve the right to update these Terms from time to time. If we make
              material changes, we will notify you via email or through the Service at least
              30 days before they take effect. Your continued use of the Service after the
              effective date constitutes acceptance of the updated Terms.
            </p>
          </Section>

          {/* 6 */}
          <Section id="warranties" title="Warranties">
            <p>
              BOTH YOU AND TRELL REPRESENT AND WARRANT THAT: (I) YOU HAVE FULL POWER AND
              AUTHORITY TO ENTER INTO THIS AGREEMENT; AND (II) DOING SO DOES NOT CONFLICT
              WITH ANY OTHER EXISTING AGREEMENTS.
            </p>
            <p>
              WE WARRANT THAT THE SERVICE WILL PERFORM MATERIALLY IN ACCORDANCE WITH ITS
              DOCUMENTATION FOR 30 DAYS FOLLOWING YOUR INITIAL USE. IF THE SERVICE FAILS TO
              MEET THIS WARRANTY, YOUR EXCLUSIVE REMEDY IS TO REQUEST A REFUND OF FEES PAID
              FOR THE SERVICE DURING THE WARRANTY PERIOD.
            </p>
            <p>
              EXCEPT AS EXPRESSLY SET FORTH ABOVE, THE SERVICE IS PROVIDED &quot;AS IS&quot;
              AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS,
              IMPLIED, OR STATUTORY, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
              PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.
            </p>
          </Section>
        </article>

        {/* TOC */}
        <LegalTOC items={toc} />
      </div>
    </>
  );
}
