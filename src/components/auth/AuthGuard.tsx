import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

interface AuthGuardProps {
  children: React.ReactNode;
  /** Skip onboarding check (e.g., for admin pages) */
  skipOnboarding?: boolean;
}

/**
 * Server component that handles authentication and onboarding checks.
 * Use this in layouts to protect routes.
 */
export async function AuthGuard({ children, skipOnboarding = false }: AuthGuardProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not authenticated - redirect to login
  if (!user) {
    redirect("/login");
  }

  // Check onboarding status
  if (!skipOnboarding) {
    const { count } = await supabase
      .from("accounts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (count === 0) {
      redirect("/onboarding/accounts");
    }
  }

  return <>{children}</>;
}

/**
 * Guard for onboarding pages - redirects to home if user already has accounts
 */
export async function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not authenticated - redirect to login
  if (!user) {
    redirect("/login");
  }

  // Check if user already has accounts
  const { count } = await supabase
    .from("accounts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (count && count > 0) {
    redirect("/");
  }

  return <>{children}</>;
}

/**
 * Guard for login page - redirects to home if already logged in
 */
export async function LoginGuard({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Already authenticated - redirect to home
  if (user) {
    redirect("/");
  }

  return <>{children}</>;
}
