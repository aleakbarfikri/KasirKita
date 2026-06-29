import { useEffect, useState } from "react";

async function parseError(response: Response) {
  try {
    const payload = await response.json();
    return payload?.error?.message || payload?.message || `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

export const authClient = {
  signIn: {
    username: async ({ username, password }: { username: string; password: string }) => {
      const response = await fetch("/api/auth/sign-in/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) return { data: null, error: { message: await parseError(response) } };
      return { data: await response.json(), error: null };
    },
  },
  signOut: async () => {
    await fetch("/api/auth/sign-out", { method: "POST", credentials: "include" });
  },
  useSession: () => {
    const [isPending, setIsPending] = useState(true);
    useEffect(() => setIsPending(false), []);
    return { data: null, error: null, isPending };
  },
};
