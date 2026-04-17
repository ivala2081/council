import { AppHeader } from "@/components/app-header";

export const metadata = {
  title: "Terms of Service — Council",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-2xl mx-auto px-6 py-16 space-y-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Terms of Service
        </h1>

        <p className="text-sm text-muted-foreground">
          Last updated: April 2026
        </p>

        <section className="space-y-3 text-sm text-foreground/80 leading-relaxed">
          <h2 className="text-base font-medium text-foreground">
            What Council is
          </h2>
          <p>
            Council provides AI-generated opinions about startup ideas. These
            are not investment advice, legal advice, or business guarantees. Use
            the results at your own judgment.
          </p>
        </section>

        <section className="space-y-3 text-sm text-foreground/80 leading-relaxed">
          <h2 className="text-base font-medium text-foreground">
            Service provided as-is
          </h2>
          <p>
            Council is provided &ldquo;as is&rdquo; without warranties of any
            kind, express or implied. We do not guarantee the accuracy,
            completeness, or usefulness of any verdict or analysis.
          </p>
        </section>

        <section className="space-y-3 text-sm text-foreground/80 leading-relaxed">
          <h2 className="text-base font-medium text-foreground">
            Fair use
          </h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              Don&apos;t abuse the service with automated or excessive requests.
            </li>
            <li>
              Don&apos;t attempt to extract, reverse-engineer, or replicate the
              AI prompts or scoring logic.
            </li>
            <li>
              Don&apos;t submit content that is illegal, harmful, or violates
              others&apos; rights.
            </li>
          </ul>
        </section>

        <section className="space-y-3 text-sm text-foreground/80 leading-relaxed">
          <h2 className="text-base font-medium text-foreground">
            Limitation of liability
          </h2>
          <p>
            Council and its creators are not liable for any decisions made based
            on the AI-generated verdicts. You are solely responsible for your
            business decisions.
          </p>
        </section>

        <section className="space-y-3 text-sm text-foreground/80 leading-relaxed">
          <h2 className="text-base font-medium text-foreground">
            Changes
          </h2>
          <p>
            We may update these terms as the service evolves. Continued use of
            Council after changes constitutes acceptance of the new terms.
          </p>
        </section>
      </main>
    </div>
  );
}
