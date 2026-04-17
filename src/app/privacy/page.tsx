import { AppHeader } from "@/components/app-header";

export const metadata = {
  title: "Privacy Policy — Council",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-2xl mx-auto px-6 py-16 space-y-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Privacy Policy
        </h1>

        <p className="text-sm text-muted-foreground">
          Last updated: April 2026
        </p>

        <section className="space-y-3 text-sm text-foreground/80 leading-relaxed">
          <h2 className="text-base font-medium text-foreground">
            What we collect
          </h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong>Idea text</strong> you submit to generate a verdict. This
              is stored to display your results and history.
            </li>
            <li>
              <strong>Anonymous analytics events</strong> (page views, button
              clicks) to understand how Council is used. No personally
              identifiable information is attached.
            </li>
            <li>
              <strong>Feedback</strong> you optionally submit (ratings, free
              text) to improve verdict quality.
            </li>
          </ul>
        </section>

        <section className="space-y-3 text-sm text-foreground/80 leading-relaxed">
          <h2 className="text-base font-medium text-foreground">
            How we store it
          </h2>
          <p>
            All data is stored in a Supabase (PostgreSQL) database. We do not
            use cookies or require user accounts. A random token stored in your
            browser&apos;s local storage links your sessions — clearing your
            browser data removes this link.
          </p>
        </section>

        <section className="space-y-3 text-sm text-foreground/80 leading-relaxed">
          <h2 className="text-base font-medium text-foreground">
            What we don&apos;t do
          </h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>We don&apos;t sell your data.</li>
            <li>We don&apos;t share your ideas with third parties.</li>
            <li>
              We don&apos;t use your data to train AI models — your ideas are
              sent to Anthropic&apos;s Claude API for real-time analysis only.
            </li>
          </ul>
        </section>

        <section className="space-y-3 text-sm text-foreground/80 leading-relaxed">
          <h2 className="text-base font-medium text-foreground">
            Data deletion
          </h2>
          <p>
            To request deletion of your data, email{" "}
            <a
              href="mailto:halavi1394@gmail.com"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              halavi1394@gmail.com
            </a>{" "}
            with your request.
          </p>
        </section>
      </main>
    </div>
  );
}
