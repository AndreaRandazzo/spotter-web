import { createContext, useState, useEffect, type ReactNode } from "react";
import { login as loginApi, register as registerApi, getCurrentUser } from "../api/auth";
import { TOKEN_KEY } from "../api/client";
import type { RegisterRequest, UserResponse } from "../types/auth";

interface AuthContextValue {
  user: UserResponse | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (request: RegisterRequest) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount: if a token is already stored, try to restore the session.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }

    getCurrentUser()
      .then(setUser)
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  async function authenticateWithToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
    const currentUser = await getCurrentUser();
    setUser(currentUser);
  }

  async function login(email: string, password: string) {
    const auth = await loginApi({ email, password });
    await authenticateWithToken(auth.token);
  }

  async function register(request: RegisterRequest) {
    const auth = await registerApi(request);
    await authenticateWithToken(auth.token);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
