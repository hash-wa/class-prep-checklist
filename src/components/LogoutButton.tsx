"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogoutIcon } from "@/components/icons";

export function LogoutButton({ iconOnly }: { iconOnly?: boolean } = {}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (iconOnly) {
    return (
      <button
        onClick={handleLogout}
        disabled={loading}
        aria-label="Sign out"
        title="Sign out"
        className="flex h-9 w-9 items-center justify-center rounded-md text-black/60 transition-colors hover:bg-black/5 hover:text-black disabled:opacity-50 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
      >
        <LogoutIcon />
      </button>
    );
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="text-sm text-black/60 hover:text-black disabled:opacity-50 dark:text-white/60 dark:hover:text-white"
    >
      {loading ? "Signing out..." : "Sign out"}
    </button>
  );
}
