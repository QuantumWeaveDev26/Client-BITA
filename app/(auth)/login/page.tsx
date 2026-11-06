import { Button, ErrorNote, Field, Input } from "@/components/ui";
import { signIn } from "./actions";

export const metadata = { title: "Log in – BITA" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-12">
      <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Bangalore Inspection &amp; Testing Agency</p>
      <h1 className="mb-6 text-2xl font-bold">Business Management System</h1>
      <ErrorNote message={error ? "Email or password is not correct." : undefined} />
      <form action={signIn} className="space-y-4">
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password">
          <Input name="password" type="password" autoComplete="current-password" required />
        </Field>
        <Button type="submit" className="w-full">
          Log in
        </Button>
      </form>
    </main>
  );
}
