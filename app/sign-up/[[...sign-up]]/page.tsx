import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-[100dvh] bg-gray-950 px-6 py-10">
      <div className="text-center mb-6">
        <div className="text-5xl mb-2">⚡</div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Brève</h1>
        <p className="text-sm text-gray-500 mt-1">Create your account</p>
      </div>
      <SignUp
        signInUrl="/sign-in"
        fallbackRedirectUrl="/"
        appearance={{ elements: { footer: { display: 'flex' } } }}
      />
    </main>
  );
}
