// DEV-ONLY preview page — delete after screenshotting
import OnboardingWizard from '@/app/components/budget/OnboardingWizard'

export default function OnboardingPreview() {
  if (process.env.NODE_ENV !== 'development') return null
  return <OnboardingWizard userId="00000000-0000-0000-0000-000000000001" hasExistingSetup={false} />
}
