import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { AxiosError } from "axios";
import { useAuth } from "../auth/useAuth";
import FormField from "../ui/FormField";
import Button from "../ui/Button";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldName = "email" | "password";

function validate(fields: {
  email: string;
  password: string;
}): Partial<Record<FieldName, string>> {
  const errors: Partial<Record<FieldName, string>> = {};

  if (!fields.email.trim()) {
    errors.email = "L'email è obbligatoria";
  } else if (!EMAIL_REGEX.test(fields.email)) {
    errors.email = "Inserisci un'email valida";
  }

  if (!fields.password) {
    errors.password = "La password è obbligatoria";
  }

  return errors;
}

export default function LoginPage() {
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<FieldName, string>>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const errors = validate({ email, password });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

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
            error={fieldErrors.email}
            autoComplete="email"
          />

          <FormField
            id="password"
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            error={fieldErrors.password}
            autoComplete="current-password"
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
