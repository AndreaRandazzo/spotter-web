import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { AxiosError } from "axios";
import { useAuth } from "../auth/useAuth";
import type { ApiErrorResponse } from "../types/auth";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldName =
  | "email"
  | "password"
  | "confirmPassword"
  | "firstName"
  | "lastName";

function validate(fields: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}): Partial<Record<FieldName, string>> {
  const errors: Partial<Record<FieldName, string>> = {};

  if (!fields.firstName.trim()) {
    errors.firstName = "Il nome è obbligatorio";
  } else if (fields.firstName.trim().length > 100) {
    errors.firstName = "Il nome non può superare i 100 caratteri";
  }

  if (!fields.lastName.trim()) {
    errors.lastName = "Il cognome è obbligatorio";
  } else if (fields.lastName.trim().length > 100) {
    errors.lastName = "Il cognome non può superare i 100 caratteri";
  }

  if (!fields.email.trim()) {
    errors.email = "L'email è obbligatoria";
  } else if (!EMAIL_REGEX.test(fields.email)) {
    errors.email = "Inserisci un'email valida";
  }

  if (fields.password.length < 8) {
    errors.password = "La password deve avere almeno 8 caratteri";
  } else if (fields.password.length > 72) {
    errors.password = "La password non può superare i 72 caratteri";
  }

  if (fields.password !== fields.confirmPassword) {
    errors.confirmPassword = "Le password non coincidono";
  }

  return errors;
}

export default function RegisterPage() {
  const { register } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<FieldName, string>>
  >({});
  const [genericError, setGenericError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setGenericError(null);

    const errors = validate({
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await register({
        email,
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
    } catch (err) {
      if (err instanceof AxiosError && err.response) {
        const { status, data } = err.response;
        if (status === 409) {
          setFieldErrors({ email: "Questa email è già registrata" });
        } else if (status === 400) {
          const body = data as ApiErrorResponse;
          if (body.fieldErrors) {
            setFieldErrors(body.fieldErrors);
          } else {
            setGenericError(body.message || "Dati non validi. Riprova.");
          }
        } else {
          setGenericError("Qualcosa è andato storto. Riprova.");
        }
      } else {
        setGenericError("Qualcosa è andato storto. Riprova.");
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
        <p className="text-sm text-stone-400 mb-8">Crea il tuo account</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="firstName"
              className="block text-sm font-medium text-stone-300 mb-1.5"
            >
              Nome
            </label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              className="w-full rounded-md border border-stone-700 bg-stone-900 px-3 py-2 text-stone-100 placeholder-stone-600 focus:border-stone-500 focus:outline-none"
            />
            {fieldErrors.firstName && (
              <p role="alert" className="text-sm text-red-400 mt-1">
                {fieldErrors.firstName}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="lastName"
              className="block text-sm font-medium text-stone-300 mb-1.5"
            >
              Cognome
            </label>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
              className="w-full rounded-md border border-stone-700 bg-stone-900 px-3 py-2 text-stone-100 placeholder-stone-600 focus:border-stone-500 focus:outline-none"
            />
            {fieldErrors.lastName && (
              <p role="alert" className="text-sm text-red-400 mt-1">
                {fieldErrors.lastName}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-stone-300 mb-1.5"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full rounded-md border border-stone-700 bg-stone-900 px-3 py-2 text-stone-100 placeholder-stone-600 focus:border-stone-500 focus:outline-none"
            />
            {fieldErrors.email && (
              <p role="alert" className="text-sm text-red-400 mt-1">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-stone-300 mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-md border border-stone-700 bg-stone-900 px-3 py-2 text-stone-100 placeholder-stone-600 focus:border-stone-500 focus:outline-none"
            />
            {fieldErrors.password && (
              <p role="alert" className="text-sm text-red-400 mt-1">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-stone-300 mb-1.5"
            >
              Conferma password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-md border border-stone-700 bg-stone-900 px-3 py-2 text-stone-100 placeholder-stone-600 focus:border-stone-500 focus:outline-none"
            />
            {fieldErrors.confirmPassword && (
              <p role="alert" className="text-sm text-red-400 mt-1">
                {fieldErrors.confirmPassword}
              </p>
            )}
          </div>

          {genericError && (
            <p role="alert" className="text-sm text-red-400">
              {genericError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-stone-100 px-4 py-2.5 font-medium text-stone-950 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {submitting ? "Registrazione in corso…" : "Registrati"}
          </button>
        </form>

        <p className="text-center text-sm text-stone-400 mt-6">
          Hai già un account?{" "}
          <Link
            to="/login"
            className="text-stone-200 hover:text-white transition-colors"
          >
            Accedi
          </Link>
        </p>
      </div>
    </div>
  );
}
