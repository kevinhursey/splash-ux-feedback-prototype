export type FeedbackSubmission = {
  id: string
  submittedAt: string
  selectedAreas: string[]
  improvementsByArea: Record<string, string[]>
  detailsByArea: Record<string, Record<string, string>>
  /** Final-step textarea after category-based topic details */
  additionalFeedback: string
  /** Reserved for integrations; main UI routes all feedback through areas */
  standaloneFeedback?: string
  email?: string
  canContact: boolean
}

export type FeedbackPayload = Omit<FeedbackSubmission, 'id' | 'submittedAt'>
