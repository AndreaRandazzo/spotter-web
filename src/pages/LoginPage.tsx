import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { AxiosError } from "axios";
import { useAuth } from "../auth/useAuth";
import FormField from "../ui/FormField";
import Button from "../ui/Button";

export default function LoginPage() {
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email, password);
    } catch (err) {
      if (err instanceof AxiosError && err.response?.status === 401) {
        setError("Email o password non corretti");
      } else {
        setError("Qualcosa è andato storto. Riprova.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-950 px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-4xl font-bold tracking-tight text-stone-100 mb-2">
          Spotter
        </h1>
        <p className="text-sm text-stone-400 mb-8">
          Il tuo PT vede ogni serie. Ovunque sia.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            required
          />

          <FormField
            id="password"
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            required
          />

          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}

          <Button type="submit" disabled={submitting}>
            {submitting ? "Accesso in corso…" : "Accedi"}
          </Button>
        </form>

        <p className="text-center text-sm text-stone-400 mt-6">
          Non hai un account?{" "}
          <Link
            to="/register"
            className="text-stone-200 hover:text-white transition-colors"
          >
            Registrati
          </Link>
        </p>
      </div>
    </div>
  );
}
