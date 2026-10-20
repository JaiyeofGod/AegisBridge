import { SignInForm } from "@/features/signin/SignInForm";
import { SignInVisual } from "@/features/signin/SignInVisual";

/** Desktop composition targets ~824px visual / ~616px form at 1440px. */
export function SignInPage() {
  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--text)]" data-testid="signin-page">
      <div className="mx-auto grid min-h-screen max-w-[1440px] lg:grid-cols-[minmax(0,1.34fr)_minmax(0,1fr)]">
        <section className="border-b border-[var(--border)] lg:border-r lg:border-b-0">
          <SignInVisual />
        </section>
        <section className="bg-[var(--canvas)]">
          <SignInForm />
        </section>
      </div>
    </div>
  );
}
