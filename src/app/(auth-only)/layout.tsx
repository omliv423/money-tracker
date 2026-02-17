import { AuthGuard } from "@/components/auth/AuthGuard";

export default function AuthOnlyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard skipOnboarding>{children}</AuthGuard>;
}
