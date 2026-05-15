const SESSION_STORAGE_KEY = 'conference-feedback-session-id'

export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') {
    return 'unknown-session'
  }
  try {
    let id = sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (!id) {
      id = crypto.randomUUID()
      sessionStorage.setItem(SESSION_STORAGE_KEY, id)
    }
    return id
  } catch {
    return crypto.randomUUID()
  }
}
