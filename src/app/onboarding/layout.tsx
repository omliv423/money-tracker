import { OnboardingGuard } from "@/components/auth/AuthGuard";

export default function OnboardingAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OnboardingGuard>
      <div className="min-h-screen bg-background">
        {children}
      </div>
    </OnboardingGuard>
  );
}
