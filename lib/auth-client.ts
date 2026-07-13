import { useEffect, useState } from "react";

async function parseError(response: Response) {
  try {
    const payload = await response.json();
    return {
      message: payload?.error?.message || payload?.message || `Request failed with status ${response.status}`,
      details: payload?.error?.details,
      status: response.status,
    };
  } catch {
    return { message: `Request failed with status ${response.status}`, details: undefined, status: response.status };
  }
}

export const authClient = {
  signIn: {
    username: async ({ username, password, mfaCode }: { username: string; password: string; mfaCode?: string }) => {
      const response = await fetch("/api/auth/sign-in/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password, mfaCode }),
      });
      if (!response.ok) return { data: null, error: await parseError(response) };
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
