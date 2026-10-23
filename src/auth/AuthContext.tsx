import { useState, useEffect, type ReactNode } from "react";
import { login as loginApi, register as registerApi, getCurrentUser } from "../api/auth";
import { TOKEN_KEY } from "../api/client";
import type { RegisterRequest, UserResponse } from "../types/auth";
import { AuthContext } from "./context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState(
    () => localStorage.getItem(TOKEN_KEY) !== null,
  );

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

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
