import { AuthGuard } from "@/components/auth/AuthGuard";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Skip onboarding check for admin pages
  return <AuthGuard skipOnboarding>{children}</AuthGuard>;
}
