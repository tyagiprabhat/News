import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-[100dvh] bg-canvas px-6 py-10">
      <div className="text-center mb-6">
        <h1 className="font-display text-4xl font-semibold text-ink tracking-tight">Brève</h1>
        <span className="rule-accent w-16 mx-auto mt-2" />
        <p className="text-sm text-ink-muted mt-3">The world&apos;s news in 60 words</p>
      </div>
      <SignIn signUpUrl="/sign-up" fallbackRedirectUrl="/" />
    </main>
  );
}
