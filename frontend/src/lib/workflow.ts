export type WorkflowStep = {
  order: number
  to: string
  navLabel: string
  title: string
  description: string
  matchPrefixes: string[]
}

export const workflowSteps: WorkflowStep[] = [
  {
    order: 1,
    to: '/billing',
    navLabel: 'Plan',
    title: 'Choose a plan',
    description: 'Activate billing state and set the quota limits your tenant will run on.',
    matchPrefixes: ['/billing'],
  },
  {
    order: 2,
    to: '/entitlements',
    navLabel: 'Access',
    title: 'Review entitlements',
    description: 'Confirm which features are included and what limit each feature carries.',
    matchPrefixes: ['/entitlements'],
  },
  {
    order: 3,
    to: '/api-keys',
    navLabel: 'Integrate',
    title: 'Create an API key',
    description: 'Connect your backend or worker so it can check quotas and report usage.',
    matchPrefixes: ['/api-keys'],
  },
  {
    order: 4,
    to: '/usage',
    navLabel: 'Analytics',
    title: 'Inspect usage',
    description: 'Watch live rollups, feature totals, and daily activity once events arrive.',
    matchPrefixes: ['/usage'],
  },
]

export function getWorkflowStep(pathname: string) {
  return workflowSteps.find((step) => step.matchPrefixes.some((prefix) => pathname.startsWith(prefix))) ?? null
}

export function getNextWorkflowStep(pathname: string) {
  const currentStep = getWorkflowStep(pathname)
  if (!currentStep) return workflowSteps[0] ?? null
  return workflowSteps.find((step) => step.order === currentStep.order + 1) ?? null
}
