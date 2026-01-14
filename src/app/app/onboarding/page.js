import { Suspense } from "react";
import OnboardingClient from "./onboarding-client";

export const dynamic = "force-dynamic";

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl space-y-8" />}>
      <OnboardingClient />
    </Suspense>
  );
}
