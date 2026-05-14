import { createPortal } from 'react-dom'
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import welcomeVisual from './assets/f6a77ee25998cd0c15c2b8a0d6bef7386ffd840a-5235x3490.webp'

type Step =
  | 'welcome'
  | 'areas'
  | 'improvements'
  | 'detail'
  | 'catch-all'
  | 'thank-you'

/** Full-window overlay: generous horizontal bleed; `html.welcome-expand-active` clips overflow */
function getExpandOverlayViewportPx() {
  if (typeof window === 'undefined') {
    return { w: 0, h: 0 }
  }
  const vv = window.visualViewport
  const docEl = document.documentElement
  const layoutW = Math.max(
    window.innerWidth,
    docEl.clientWidth,
    docEl.getBoundingClientRect().width,
  )
  const w = Math.ceil(layoutW + 48)
  const h = Math.ceil((vv?.height ?? window.innerHeight) + 4)
  return { w, h }
}

/** Welcome → areas: white card expands to full viewport (duration, ms) */
const WELCOME_EXPAND_MS = 600

/** Max improvement rows a user can pick on each area’s checklist step */
const MAX_TOPICS_PER_AREA = 3

/** Plain rect snapshot — avoid live DOMRect reads after layout */
type WelcomeOverlayRect = {
  left: number
  top: number
  width: number
  height: number
}

function welcomeShrinkTargetFromSectionRect(
  rect: DOMRectReadOnly,
): WelcomeOverlayRect {
  const left = rect.left
  const top = rect.top
  const width = rect.right - left
  const height = rect.bottom - top
  return { left, top, width, height }
}

/**
 * Welcome ← flow: measure in one layout effect, then rAF kick in a *separate* effect
 * so cleanup from `cover → shrink` cannot cancel the scheduled rAF chain (stuck fullscreen).
 */
type ShrinkToWelcomeState =
  | { kind: 'measure' }
  | { kind: 'anim'; to: WelcomeOverlayRect; cover: boolean }

type Area = {
  id: string
  title: string
  description: string
  improvements: string[]
  /** When set, used on the improvements step instead of the default “Select all …” line */
  improvementsStepHeading?: string
  /** When set, used on the detail step instead of “Add details for your … topics” */
  detailsStepHeading?: string
}

type FeedbackSubmission = {
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

const AREAS: Area[] = [
  {
    id: 'reporting',
    title: 'Reporting',
    description: 'Creating and formatting reports',
    improvements: [
      'Faster report creation',
      'Improved report formatting',
      'Easier POV understanding in reports',
      'Better data visualizations for different user groups',
      'Easier dashboard creation',
      'Easier ad hoc report creation',
      'Other',
    ],
  },
  {
    id: 'planning',
    title: 'Business Process Flows',
    description: 'Workflows and process management',
    improvements: [
      'Clearer process flows based on user roles',
      'Easier visibility into process status for end users',
      'Better handling of different workflow levels',
      'Easier workflow POV management',
      'Clearer distinction between mandatory and optional workflow steps',
      'Fewer limitations on file uploads',
      'Other',
    ],
  },
  {
    id: 'dashboards',
    title: 'Modeling',
    description: 'Scenario modeling and configuration',
    improvements: [
      'Easier scenario modeling in OneStream',
      'Easier Excel and spreadsheet integration for modeling',
      'Easier configuration of modeling scenarios',
      'Faster scenario iteration and testing',
      'Easier consolidation calculations',
      'Other',
    ],
  },
  {
    id: 'navigation',
    title: 'Rules and Formulas',
    description: 'Writing and configuring formulas',
    improvements: [
      'Easier rule and formula creation',
      'Simpler formula configuration in OneStream',
      'Easier rule management and maintenance',
      'Other',
    ],
  },
  {
    id: 'workflows',
    title: 'Data Input',
    description: 'Forms and manual data entry',
    improvements: [
      'Easier custom form creation and publishing',
      'Simpler manual data entry setup',
      'Better live updates during data entry',
      'Easier direct data connections',
      'Other',
    ],
  },
  {
    id: 'data-integration',
    title: 'System Design',
    description: 'Environment and UI configuration',
    improvements: [
      'Easier management of dev, test, and production environments',
      'Better balance between system branding and default styling',
      'Light and dark mode support',
      'Easier dashboard and cube search in the navigation pane',
      'Better visibility into performance issues',
      'Other',
    ],
  },
  {
    id: 'security',
    title: 'Documentation',
    description: 'Help and learning resources',
    improvements: [
      'Easier onboarding with help and documentation',
      'Better AI-assisted documentation support',
      'Centralized compliance documentation',
      'Easier access to configuration help',
      'Improved in-app help and guidance',
      'Other',
    ],
  },
  {
    id: 'mobile',
    title: 'Application Configuration',
    description: 'Tools and data setup',
    improvements: [
      'Easier discovery of solutions and tools within OneStream',
      'Easier data configuration',
      'Simpler security setup',
      'Better metadata management',
      'Other',
    ],
  },
  {
    id: 'other',
    title: 'Other',
    description: 'Topics not captured above',
    improvementsStepHeading:
      'Choose the themes that best match what you want to share',
    detailsStepHeading: 'Add details for the themes you selected',
    improvements: [
      'Different workflow or use case',
      'Product direction or strategy',
      'Integration or ecosystem',
      'Performance or reliability',
      'Other',
    ],
  },
]

async function submitFeedback(
  payload: Omit<FeedbackSubmission, 'id' | 'submittedAt'>,
): Promise<FeedbackSubmission> {
  // Placeholder adapter for future integrations (Supabase/Firebase/Airtable/API).
  return Promise.resolve({
    id: crypto.randomUUID(),
    submittedAt: new Date().toISOString(),
    ...payload,
  })
}

function App() {
  const [step, setStep] = useState<Step>('welcome')
  const [selectedAreas, setSelectedAreas] = useState<string[]>([])
  const [currentAreaIndex, setCurrentAreaIndex] = useState(0)
  const [improvementsByArea, setImprovementsByArea] = useState<
    Record<string, string[]>
  >({})
  const [detailsByArea, setDetailsByArea] = useState<
    Record<string, Record<string, string>>
  >({})
  const [submissions, setSubmissions] = useState<FeedbackSubmission[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [additionalFeedback, setAdditionalFeedback] = useState('')
  const [email, setEmail] = useState('')
  const [canContact, setCanContact] = useState(false)

  const sectionRef = useRef<HTMLElement | null>(null)
  const expandingOverlayRef = useRef<HTMLDivElement | null>(null)
  const reverseWelcomeOverlayRef = useRef<HTMLDivElement | null>(null)
  const [expandFromWelcome, setExpandFromWelcome] = useState<
    null | { from: DOMRectReadOnly; expanded: boolean }
  >(null)
  const [shrinkToWelcome, setShrinkToWelcome] =
    useState<ShrinkToWelcomeState | null>(null)
  /** Remount shrink overlay per reverse run so stuck transitions / stale styles cannot persist */
  const [welcomeShrinkSession, setWelcomeShrinkSession] = useState(0)
  /** Bumped when shrink-to-welcome finishes so copy remounts with `page-step-enter` after overlay */
  const [welcomeCopyEnterNonce, setWelcomeCopyEnterNonce] = useState(0)

  useEffect(() => {
    const id = 'welcome-hero-preload'
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'preload'
    link.as = 'image'
    link.href = welcomeVisual
    document.head.appendChild(link)
    return () => {
      document.getElementById(id)?.remove()
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    const body = document.body
    if (step === 'welcome') {
      root.classList.add('welcome-splash')
      body.classList.add('welcome-splash')
      body.classList.remove('feedback-flow')
    } else {
      root.classList.remove('welcome-splash')
      body.classList.remove('welcome-splash')
      body.classList.add('feedback-flow')
    }
    return () => {
      root.classList.remove('welcome-splash')
      body.classList.remove('welcome-splash')
      body.classList.remove('feedback-flow')
    }
  }, [step])

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [step])

  useLayoutEffect(() => {
    if (!expandFromWelcome || expandFromWelcome.expanded) return
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setExpandFromWelcome((prev) =>
          prev && !prev.expanded ? { ...prev, expanded: true } : prev,
        )
      })
    })
    return () => cancelAnimationFrame(id)
  }, [expandFromWelcome])

  useEffect(() => {
    if (!expandFromWelcome?.expanded) return
    const el = expandingOverlayRef.current
    const done = () => {
      setStep('areas')
      setExpandFromWelcome(null)
    }
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      done()
    }
    if (!el) {
      finish()
      return
    }
    el.addEventListener('transitionend', finish)
    const t = window.setTimeout(finish, WELCOME_EXPAND_MS + 100)
    return () => {
      el.removeEventListener('transitionend', finish)
      window.clearTimeout(t)
    }
  }, [expandFromWelcome])

  useLayoutEffect(() => {
    if (step !== 'welcome' || shrinkToWelcome?.kind !== 'measure') return
    let alive = true
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!alive) return
        const section = sectionRef.current
        const rect = section?.getBoundingClientRect()
        if (!rect || rect.width < 12) {
          setShrinkToWelcome(null)
          setWelcomeCopyEnterNonce((n) => n + 1)
          return
        }
        const to = welcomeShrinkTargetFromSectionRect(rect)
        setShrinkToWelcome({ kind: 'anim', to, cover: true })
      })
    })
    return () => {
      alive = false
    }
  }, [shrinkToWelcome, step])

  useLayoutEffect(() => {
    if (shrinkToWelcome?.kind !== 'anim' || !shrinkToWelcome.cover) return
    let alive = true
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!alive) return
          const section = sectionRef.current
          const refined = section?.getBoundingClientRect()
          setShrinkToWelcome((prev) => {
            if (!prev || prev.kind !== 'anim' || !prev.cover) return prev
            const to =
              refined && refined.width >= 12
                ? welcomeShrinkTargetFromSectionRect(refined)
                : prev.to
            return { ...prev, to, cover: false }
          })
        })
      })
    })
    return () => {
      alive = false
    }
  }, [shrinkToWelcome])

  useEffect(() => {
    if (
      !shrinkToWelcome ||
      shrinkToWelcome.kind !== 'anim' ||
      shrinkToWelcome.cover
    )
      return
    const el = reverseWelcomeOverlayRef.current
    const done = () => {
      setShrinkToWelcome(null)
      setWelcomeCopyEnterNonce((n) => n + 1)
    }
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      done()
    }
    const onTransitionEnd = (e: TransitionEvent) => {
      if (e.target !== el) return
      if (e.propertyName !== 'width') return
      finish()
    }
    if (!el) {
      finish()
      return
    }
    el.addEventListener('transitionend', onTransitionEnd)
    const t = window.setTimeout(finish, WELCOME_EXPAND_MS + 150)
    return () => {
      el.removeEventListener('transitionend', onTransitionEnd)
      window.clearTimeout(t)
    }
  }, [shrinkToWelcome])

  useEffect(() => {
    const root = document.documentElement
    if (expandFromWelcome || shrinkToWelcome) {
      root.classList.add('welcome-expand-active')
    } else {
      root.classList.remove('welcome-expand-active')
    }
    return () => {
      root.classList.remove('welcome-expand-active')
    }
  }, [expandFromWelcome, shrinkToWelcome])

  const selectedAreaModels = useMemo(
    () =>
      selectedAreas
        .map((id) => AREAS.find((area) => area.id === id))
        .filter((area): area is Area => area != null),
    [selectedAreas],
  )

  const currentArea = selectedAreaModels[currentAreaIndex]
  const currentSelections = currentArea
    ? improvementsByArea[currentArea.id] ?? []
    : []

  const isLastImprovementScreen =
    currentAreaIndex === selectedAreaModels.length - 1

  const toggleArea = (areaId: string) => {
    setSelectedAreas((previous) =>
      previous.includes(areaId)
        ? previous.filter((id) => id !== areaId)
        : [...previous, areaId],
    )
  }

  const toggleImprovement = (areaId: string, improvement: string) => {
    setImprovementsByArea((previous) => {
      const selected = previous[areaId] ?? []
      if (selected.includes(improvement)) {
        return {
          ...previous,
          [areaId]: selected.filter((item) => item !== improvement),
        }
      }
      if (selected.length >= MAX_TOPICS_PER_AREA) {
        return previous
      }
      return { ...previous, [areaId]: [...selected, improvement] }
    })

    setDetailsByArea((previous) => {
      const areaDetails = previous[areaId] ?? {}
      if (!(improvement in areaDetails)) {
        return previous
      }

      const nextAreaDetails = { ...areaDetails }
      delete nextAreaDetails[improvement]

      return { ...previous, [areaId]: nextAreaDetails }
    })
  }

  const handleImprovementDetailChange = (
    areaId: string,
    improvement: string,
    value: string,
  ) => {
    setDetailsByArea((previous) => ({
      ...previous,
      [areaId]: {
        ...(previous[areaId] ?? {}),
        [improvement]: value,
      },
    }))
  }

  /** Single free-text bucket when skipping the "Other" area theme checklist */
  const otherAreaDetailImprovement = 'Other'

  const goToImprovementFlow = () => {
    setCurrentAreaIndex(0)
    const first = selectedAreaModels[0]
    if (first?.id === 'other') {
      setImprovementsByArea((previous) => ({
        ...previous,
        other: [otherAreaDetailImprovement],
      }))
      setStep('detail')
      return
    }
    setStep('improvements')
  }

  const handleContinueImprovements = () => {
    setStep('detail')
  }

  const handleBackImprovements = () => {
    if (currentAreaIndex === 0) {
      setStep('areas')
      return
    }

    setCurrentAreaIndex((value) => value - 1)
    setStep('detail')
  }

  const handleContinueDetails = () => {
    if (isLastImprovementScreen) {
      setStep('catch-all')
      return
    }

    const nextIndex = currentAreaIndex + 1
    const nextArea = selectedAreaModels[nextIndex]
    setCurrentAreaIndex(nextIndex)

    if (nextArea?.id === 'other') {
      setImprovementsByArea((previous) => ({
        ...previous,
        other: [otherAreaDetailImprovement],
      }))
      setStep('detail')
      return
    }

    setStep('improvements')
  }

  const handleBackDetails = () => {
    if (currentArea?.id === 'other') {
      if (currentAreaIndex === 0) {
        setStep('areas')
        return
      }
      setCurrentAreaIndex((value) => value - 1)
      setStep('detail')
      return
    }
    setStep('improvements')
  }

  const handleBackCatchAll = () => {
    setStep('detail')
  }

  const handleSubmitClick = () => {
    if (canContact && email.trim().length === 0) return
    void handleSubmit()
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    const submission = await submitFeedback({
      selectedAreas,
      improvementsByArea,
      detailsByArea,
      additionalFeedback,
      standaloneFeedback: undefined,
      email:
        canContact && email.trim().length > 0 ? email.trim() : undefined,
      canContact,
    })
    setSubmissions((previous) => [submission, ...previous])
    setIsSubmitting(false)
    setStep('thank-you')
  }

  const handleGetStarted = () => {
    setShrinkToWelcome(null)
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setStep('areas')
      return
    }
    const el = sectionRef.current
    const rect = el?.getBoundingClientRect()
    if (!rect || rect.width < 12) {
      setStep('areas')
      return
    }
    setExpandFromWelcome({ from: rect, expanded: false })
  }

  const goBackToWelcome = () => {
    setExpandFromWelcome(null)
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setStep('welcome')
      return
    }
    setWelcomeShrinkSession((s) => s + 1)
    setShrinkToWelcome({ kind: 'measure' })
    setStep('welcome')
  }

  const resetFlow = () => {
    setExpandFromWelcome(null)
    setShrinkToWelcome(null)
    setSelectedAreas([])
    setCurrentAreaIndex(0)
    setImprovementsByArea({})
    setDetailsByArea({})
    setAdditionalFeedback('')
    setEmail('')
    setCanContact(false)
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setStep('welcome')
      return
    }
    setWelcomeShrinkSession((s) => s + 1)
    setShrinkToWelcome({ kind: 'measure' })
    setStep('welcome')
  }

  const buttonBaseClass =
    'inline-flex h-12 items-center justify-center rounded-none px-6 font-["OneStreamFono"] text-xl font-normal uppercase tracking-[0.5px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2'

  /** Shared column so step content stacks the same way as the improvements flow */
  const stepPrimaryColumnClass =
    'mx-auto flex w-full min-w-0 max-w-[1152px] flex-col items-center justify-start gap-0 overflow-visible'

  /** Progress row (or placeholder) — same vertical band as the improvements step */
  const stepProgressBandClass =
    'flex w-full min-w-0 shrink-0 flex-col items-center justify-start'

  /** Primary headline + body — `mt-6` aligns with other steps; `gap-y` separates headline from content on the topic grid step */
  const stepHeadlineBandClass =
    'mt-6 flex w-full min-w-0 max-w-full flex-col items-center justify-start gap-y-4 overflow-visible px-0 sm:gap-y-8 [@media(max-height:720px)_and_(max-width:1023px)]:mt-3 [@media(max-height:720px)_and_(max-width:1023px)]:gap-y-2'

  const renderAreaProgress = (compact = false) => (
    <div
      className="mb-2 w-fit min-w-0 max-w-full overflow-x-hidden"
    >
      <div
        className={`flex max-w-full min-w-0 flex-wrap items-start justify-center ${
          compact ? 'gap-y-4' : 'gap-y-4'
        } w-fit`}
      >
        {selectedAreaModels.map((area, index) => {
            const isCurrent = index === currentAreaIndex

            return (
              <div key={area.id} className="flex items-start">
                <div
                  className={`flex w-[112px] max-w-full shrink-0 flex-col items-center text-center sm:w-fit ${
                    compact ? 'sm:min-w-[132px]' : 'sm:min-w-[132px]'
                  }`}
                >
                  <span
                    className={`flex items-center justify-center rounded-full border font-['OneStreamFono'] ${
                      compact ? 'h-9 w-9 text-base' : 'h-9 w-9 text-base'
                    } ${
                      isCurrent
                        ? 'border-black bg-black text-white'
                        : 'border-transparent bg-[#e8eaed] text-[#6b7280]'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span
                    className={`mt-2 uppercase ${
                      compact ? 'text-xs leading-[1.1rem]' : 'text-xs leading-[1.1rem]'
                    } ${isCurrent ? 'font-medium text-black' : 'text-[#6b7280]'}`}
                    style={{ fontFamily: 'OneStreamFono' }}
                  >
                    {area.title}
                  </span>
                </div>
                {index < selectedAreaModels.length - 1 && (
                  <div
                    className={`${compact ? 'mt-[18px] w-8 sm:w-10' : 'mt-[18px] w-8 sm:w-10'} h-[2px] bg-[#cbd5e1]`}
                  />
                )}
              </div>
            )
          })}
      </div>
    </div>
  )

  const expandOverlay =
    expandFromWelcome && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={expandingOverlayRef}
            aria-hidden
            className="pointer-events-none fixed z-[9999] box-border bg-white will-change-[left,top,width,height,border-radius]"
            style={{
              left: expandFromWelcome.expanded ? -24 : expandFromWelcome.from.left,
              top: expandFromWelcome.expanded ? 0 : expandFromWelcome.from.top,
              width: expandFromWelcome.expanded
                ? `${getExpandOverlayViewportPx().w}px`
                : `${expandFromWelcome.from.width}px`,
              height: expandFromWelcome.expanded
                ? `${getExpandOverlayViewportPx().h}px`
                : `${expandFromWelcome.from.height}px`,
              borderRadius: expandFromWelcome.expanded ? 0 : 20,
              transitionProperty: 'left, top, width, height, border-radius',
              transitionDuration: `${WELCOME_EXPAND_MS}ms`,
              transitionTimingFunction: 'cubic-bezier(0.25, 0.85, 0.35, 1)',
            }}
          />,
          document.body,
        )
      : null

  const shrinkOverlay =
    shrinkToWelcome && typeof document !== 'undefined'
      ? createPortal(
          <div
            key={`welcome-shrink-${welcomeShrinkSession}`}
            ref={reverseWelcomeOverlayRef}
            aria-hidden
            className="pointer-events-none fixed z-[9999] box-border bg-white will-change-[left,top,width,height,border-radius]"
            style={
              shrinkToWelcome.kind === 'measure' ||
              (shrinkToWelcome.kind === 'anim' && shrinkToWelcome.cover)
                ? {
                    left: -24,
                    top: 0,
                    width: `${getExpandOverlayViewportPx().w}px`,
                    height: `${getExpandOverlayViewportPx().h}px`,
                    borderRadius: 0,
                    transitionProperty: 'left, top, width, height, border-radius',
                    transitionDuration: `${WELCOME_EXPAND_MS}ms`,
                    transitionTimingFunction:
                      'cubic-bezier(0.25, 0.85, 0.35, 1)',
                  }
                : {
                    left: shrinkToWelcome.to.left,
                    top: shrinkToWelcome.to.top,
                    width: `${shrinkToWelcome.to.width}px`,
                    height: `${shrinkToWelcome.to.height}px`,
                    borderRadius: 20,
                    transitionProperty: 'left, top, width, height, border-radius',
                    transitionDuration: `${WELCOME_EXPAND_MS}ms`,
                    transitionTimingFunction:
                      'cubic-bezier(0.25, 0.85, 0.35, 1)',
                  }
            }
          />,
          document.body,
        )
      : null

  const welcomeOverlayBusy =
    expandFromWelcome != null || shrinkToWelcome != null

  const welcomeCopyPlayStepEnter =
    step === 'welcome' &&
    shrinkToWelcome == null &&
    expandFromWelcome == null

  return (
    <>
      {expandOverlay}
      {shrinkOverlay}
      <main
        className={`box-border flex w-full min-w-0 flex-col ${
          step === 'welcome' ? 'items-stretch' : 'items-center'
        } p-6 md:justify-center ${
          step === 'welcome'
            ? 'h-full min-h-0 max-h-full flex-1 justify-center overflow-x-clip overflow-y-hidden bg-[#5564ff]'
            : 'min-h-screen justify-start overflow-x-hidden bg-white'
        }`}
      >
      <section
        ref={sectionRef}
        className={`mx-auto flex w-full min-w-0 max-w-[1470px] flex-col items-center overflow-x-hidden rounded-[20px] bg-white px-5 sm:px-0 justify-start ${
          step === 'welcome'
            ? 'min-h-0 w-full max-h-[min(100%,calc(100svh-3rem))] overflow-hidden py-0'
            : 'min-h-[calc(100dvh-3rem)] py-6'
        }`}
        style={{ width: '100%' }}
      >
        <div
          className={`flex w-full min-w-0 max-w-full flex-col items-center self-stretch overflow-visible ${
            step === 'welcome'
              ? 'min-h-0 max-h-full'
              : 'grow min-h-0 max-w-full'
          }`}
        >
          <div
            key={`${step}-${currentAreaIndex}`}
            className={`${
              step === 'welcome' ? '' : 'page-step-enter '
            }flex w-full min-w-0 max-w-full flex-col items-center ${
              step === 'thank-you' ? 'justify-center' : 'justify-between'
            } gap-0 overflow-visible ${
              step === 'welcome' ? 'min-h-0 max-h-full' : 'grow min-h-0'
            }`}
          >
        {step === 'welcome' && (
          <div className="grid min-h-0 w-full min-w-0 max-w-full grid-cols-1 items-stretch self-stretch overflow-x-hidden p-0 lg:min-h-0 lg:max-h-full lg:grid-cols-[1.25fr_1fr] lg:grid-rows-1 lg:overflow-hidden">
            <div
              key={`welcome-copy-${welcomeCopyEnterNonce}`}
              className={`${
                welcomeCopyPlayStepEnter ? 'page-step-enter ' : ''
              }mx-auto flex h-full min-h-0 w-full min-w-0 max-w-full flex-col items-start justify-start gap-6 px-6 py-8 sm:gap-8 sm:px-10 sm:py-10 [@media(max-height:720px)_and_(max-width:1023px)]:gap-4 [@media(max-height:720px)_and_(max-width:1023px)]:py-6 lg:justify-center lg:gap-8 lg:px-14 lg:py-12 [@media(min-width:1024px)_and_(max-height:720px)]:lg:gap-6 [@media(min-width:1024px)_and_(max-height:720px)]:lg:px-11 [@media(min-width:1024px)_and_(max-height:720px)]:lg:py-9`}
            >
              <div className="w-full min-w-0 space-y-6 [@media(min-width:1024px)_and_(max-height:720px)]:space-y-5">
                <h1 className="text-balance text-4xl leading-tight font-normal text-black md:text-5xl lg:text-[64px] [@media(min-width:1024px)_and_(max-height:720px)]:lg:text-[56px] [@media(min-width:1024px)_and_(max-height:720px)]:lg:leading-[1.08]">
                  Share Feedback to Improve OneStream
                </h1>
                <p className="max-w-[620px] text-lg leading-[1.4] text-black md:text-xl [@media(min-width:1024px)_and_(max-height:720px)]:lg:text-[1.0625rem] [@media(min-width:1024px)_and_(max-height:720px)]:lg:leading-snug">
                  You can help us understand what matters most to you.
                </p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={handleGetStarted}
                  disabled={welcomeOverlayBusy}
                  className={`${buttonBaseClass} bg-black text-white enabled:hover:bg-black/75 focus-visible:outline-black disabled:cursor-not-allowed disabled:opacity-60 [@media(min-width:1024px)_and_(max-height:720px)]:h-11 [@media(min-width:1024px)_and_(max-height:720px)]:px-5 [@media(min-width:1024px)_and_(max-height:720px)]:text-lg`}
                >
                  GET STARTED
                </button>
              </div>
            </div>
            <div
              key={`welcome-hero-${welcomeCopyEnterNonce}`}
              className={
                `relative hidden min-h-0 w-full self-stretch overflow-hidden rounded-tr-[20px] rounded-br-[20px] bg-[#f8f9ff] p-0 lg:block lg:h-full lg:min-h-[min(40dvh,560px)] [@media(min-width:1024px)_and_(max-height:720px)]:lg:min-h-0` +
                (welcomeCopyPlayStepEnter ? ' welcome-hero-fade-enter' : '')
              }
            >
              <img
                src={welcomeVisual}
                alt=""
                width={5235}
                height={3490}
                sizes="(min-width: 1024px) 45vw, 0px"
                className="block h-full w-full rounded-none object-cover object-center"
                decoding="sync"
                fetchPriority="high"
              />
            </div>
          </div>
        )}

        {step === 'areas' && (
          <div className={stepPrimaryColumnClass}>
            <div
              className={`${stepProgressBandClass} min-h-[66px]`}
              aria-hidden="true"
            />
            <div className={stepHeadlineBandClass}>
              <h2 className="mt-0 w-full min-w-0 max-w-full shrink-0 text-balance text-center text-3xl leading-tight font-normal text-black md:text-[32px] [@media(max-height:720px)_and_(max-width:1023px)]:text-2xl [@media(max-height:720px)_and_(max-width:1023px)]:md:text-[28px]">
                Select one or more topics to discuss
              </h2>
              <div className="mx-auto grid w-full max-w-full grid-cols-3 grid-rows-3 gap-2 overflow-visible py-0 sm:gap-3 [@media(max-height:720px)_and_(max-width:1023px)]:gap-2 lg:gap-4 [&>button]:min-w-0">
                {AREAS.map((area) => {
                  const isSelected = selectedAreas.includes(area.id)

                  return (
                    <button
                      key={area.id}
                      type="button"
                      onClick={() => toggleArea(area.id)}
                      className={`relative flex min-h-[104px] w-full shrink-0 flex-col items-center justify-center gap-0.5 self-stretch overflow-visible rounded-none border-0 px-1.5 py-2 text-left outline-none ring-offset-white transition hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 sm:min-h-[120px] sm:gap-1 sm:px-2 sm:py-2.5 md:min-h-[136px] md:px-2.5 md:py-3 ${
                        isSelected
                          ? 'bg-white ring-2 ring-inset ring-black'
                          : 'bg-[#eeeeee] hover:bg-[#d4d4d4]'
                      }`}
                    >
                      {isSelected && (
                        <span
                          className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black font-['OneStreamFono'] text-xs text-white sm:top-2 sm:right-2 sm:h-7 sm:w-7 sm:text-sm md:top-3 md:right-3"
                          aria-hidden="true"
                        >
                          {selectedAreas.indexOf(area.id) + 1}
                        </span>
                      )}
                      <p className="w-full min-w-0 break-words px-0.5 text-center text-sm font-normal leading-tight text-black sm:text-base md:text-lg">
                        {area.title}
                      </p>
                      <p className="mt-0.5 w-full min-w-0 break-words px-0.5 text-center text-[10px] leading-snug text-[#575757] sm:mt-1 sm:text-xs sm:leading-5 md:text-sm">
                        {area.description}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex w-full min-w-0 max-w-full shrink-0 justify-center gap-3 pt-8 sm:pt-8 [@media(max-height:720px)_and_(max-width:1023px)]:pt-4">
              <button
                type="button"
                onClick={goBackToWelcome}
                disabled={welcomeOverlayBusy}
                className={`${buttonBaseClass} w-[152px] border border-black bg-white text-black hover:bg-white hover:border-black/50 hover:text-black/50 focus-visible:outline-black disabled:cursor-not-allowed disabled:opacity-60`}
              >
                Back
              </button>
              <button
                type="button"
                onClick={goToImprovementFlow}
                disabled={selectedAreas.length === 0}
                className={`${buttonBaseClass} w-[152px] bg-black text-white enabled:hover:bg-black/75 focus-visible:outline-black disabled:cursor-not-allowed disabled:bg-black/50`}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {step === 'improvements' && currentArea && (
          <div className={stepPrimaryColumnClass}>
            <div className={stepProgressBandClass}>
              {renderAreaProgress()}
            </div>

            <div className={stepHeadlineBandClass}>
              <div className="mx-auto flex w-full min-w-0 max-w-full flex-col items-stretch justify-start">
                <div className="flex w-full min-w-0 flex-col items-center gap-4">
                  <h2 className="mt-0 flex w-full min-w-0 shrink-0 justify-center whitespace-nowrap text-3xl leading-tight font-normal text-black md:text-[32px] [@media(max-height:720px)_and_(max-width:1023px)]:text-2xl [@media(max-height:720px)_and_(max-width:1023px)]:md:text-[28px]">
                    <span className="shrink-0">
                      {currentArea.improvementsStepHeading ??
                        `Select all ${currentArea.title.toLowerCase()} topics you'd like to discuss`}
                    </span>
                  </h2>
                  <p
                    className="text-center text-[14px] font-normal tabular-nums tracking-[0.08em] text-[#575757]"
                    aria-live="polite"
                    aria-label={`${currentSelections.length} of ${MAX_TOPICS_PER_AREA} topics selected`}
                  >
                    {currentSelections.length} / {MAX_TOPICS_PER_AREA}
                  </p>
                </div>
                <div className="mx-auto mt-3 w-full min-w-0 max-w-[1152px] overflow-visible sm:mt-8 [@media(max-height:720px)_and_(max-width:1023px)]:mt-2">
                  <div className="flex w-full min-w-0 max-w-full flex-col justify-start gap-2 sm:gap-2 md:gap-3">
                    {currentArea.improvements.map((improvement) => {
                      const isSelected = currentSelections.includes(improvement)
                      const atTopicLimit =
                        currentSelections.length >= MAX_TOPICS_PER_AREA
                      const selectionBlocked = atTopicLimit && !isSelected

                      return (
                        <button
                          key={improvement}
                          type="button"
                          disabled={selectionBlocked}
                          title={
                            selectionBlocked
                              ? 'Maximum number of topics selected'
                              : undefined
                          }
                          onClick={() =>
                            toggleImprovement(currentArea.id, improvement)
                          }
                          className={`flex min-h-[70px] w-full shrink-0 items-center justify-between gap-2 rounded-none border-2 px-3 py-4 text-left outline-none ring-offset-white transition focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 sm:gap-3 sm:px-4 disabled:cursor-not-allowed disabled:opacity-60 ${
                            isSelected
                              ? 'border-black bg-white'
                              : 'border-transparent bg-[#eeeeee] enabled:hover:bg-[#d4d4d4]'
                          }`}
                        >
                          <span className="min-w-0 flex-1 break-words text-base leading-snug text-black sm:text-lg">
                            {improvement}
                          </span>
                          {isSelected && (
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black">
                              <svg
                                className="h-4 w-4 text-white"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                aria-hidden="true"
                              >
                                <path
                                  d="M5 12.5L9.5 17L19 7.5"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex w-full min-w-0 max-w-full shrink-0 justify-center gap-3 pt-8 sm:pt-8 [@media(max-height:720px)_and_(max-width:1023px)]:pt-4">
              <button
                type="button"
                onClick={handleBackImprovements}
                className={`${buttonBaseClass} w-[152px] border border-black bg-white text-black hover:bg-white hover:border-black/50 hover:text-black/50 focus-visible:outline-black`}
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleContinueImprovements}
                disabled={currentSelections.length === 0}
                className={`${buttonBaseClass} w-[152px] bg-black text-white enabled:hover:bg-black/75 focus-visible:outline-black disabled:cursor-not-allowed disabled:bg-black/50`}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {step === 'detail' && currentArea && currentSelections.length > 0 && (
          <div className={stepPrimaryColumnClass}>
            <div className={stepProgressBandClass}>
              {renderAreaProgress(true)}
            </div>
            <div className={stepHeadlineBandClass}>
            <div className="mx-auto flex w-full min-w-0 max-w-[768px] flex-col items-center justify-start gap-0 overflow-visible rounded-2xl px-4 py-0 sm:px-6 md:px-0">
              <div className="flex w-full min-w-0 flex-col overflow-x-hidden">
                <h2 className="mt-0 shrink-0 text-balance text-center text-2xl font-normal text-black sm:text-3xl [@media(max-height:720px)_and_(max-width:1023px)]:text-xl [@media(max-height:720px)_and_(max-width:1023px)]:sm:text-2xl">
                  {currentArea.detailsStepHeading ??
                    `Add details for your ${currentArea.title.toLowerCase()} topics`}
                </h2>
                <div className="combined-details-scroll improvements-scroll mt-4 w-full min-w-0 space-y-8 overflow-x-hidden pb-2 sm:mt-10 [@media(max-height:720px)_and_(max-width:1023px)]:mt-3 [@media(max-height:720px)_and_(max-width:1023px)]:space-y-6 [@media(max-height:720px)_and_(max-width:1023px)]:sm:mt-6">
                  {currentSelections.map((improvement, topicIndex) => (
                    <div
                      key={improvement}
                      className="flex w-full min-w-0 flex-col"
                    >
                      <h3 className="text-balance text-left text-lg font-normal text-black sm:text-xl">
                        {improvement}
                      </h3>
                      <textarea
                        id={`detail-${currentArea.id}-${topicIndex}`}
                        aria-label={`Tell us more about ${improvement} (optional)`}
                        value={
                          detailsByArea[currentArea.id]?.[improvement] ?? ''
                        }
                        onChange={(event) =>
                          handleImprovementDetailChange(
                            currentArea.id,
                            improvement,
                            event.target.value,
                          )
                        }
                        rows={4}
                        className={`mt-3 w-full min-w-0 max-w-full resize-y rounded-none border border-[#cbd5e1] px-4 py-3 text-base text-black outline-none focus:border-black focus:ring-2 focus:ring-inset focus:ring-black sm:mt-2 sm:px-5 sm:py-4 ${
                          currentSelections.length === 1
                            ? 'h-[200px] min-h-[200px]'
                            : 'h-[60px] min-h-[60px]'
                        }`}
                        placeholder="Tell us more (optional)"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex shrink-0 flex-col items-center justify-center gap-3 sm:mt-8 sm:flex-row [@media(max-height:720px)_and_(max-width:1023px)]:mt-3 [@media(max-height:720px)_and_(max-width:1023px)]:sm:mt-4">
                <button
                  type="button"
                  onClick={handleBackDetails}
                  className={`${buttonBaseClass} w-[152px] border border-black bg-white text-black hover:bg-white hover:border-black/50 hover:text-black/50 focus-visible:outline-black`}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleContinueDetails}
                  disabled={isSubmitting}
                  className={`${buttonBaseClass} w-[152px] bg-black text-white enabled:hover:bg-black/75 focus-visible:outline-black disabled:cursor-not-allowed disabled:bg-black/50`}
                >
                  {isLastImprovementScreen && isSubmitting
                    ? 'Submitting...'
                    : 'Next'}
                </button>
              </div>
            </div>
            </div>
          </div>
        )}

        {step === 'catch-all' && (
          <div className={stepPrimaryColumnClass}>
            <div className={stepProgressBandClass}>
              <div
                className="invisible pointer-events-none select-none"
                aria-hidden="true"
              >
                {renderAreaProgress(true)}
              </div>
            </div>

            <div className={stepHeadlineBandClass}>
              <div className="mx-auto flex w-full min-w-0 max-w-[768px] flex-col items-center justify-start gap-0 overflow-visible rounded-2xl px-4 py-0 sm:px-6 md:px-0">
                <div className="flex w-full min-w-0 flex-col overflow-x-hidden">
                  <h2 className="mt-0 shrink-0 text-balance text-center text-2xl font-normal text-black sm:text-3xl [@media(max-height:720px)_and_(max-width:1023px)]:text-xl [@media(max-height:720px)_and_(max-width:1023px)]:sm:text-2xl">
                    Anything else you'd like to share?
                  </h2>
                  <div className="combined-details-scroll improvements-scroll mt-4 w-full min-w-0 overflow-x-hidden pb-2 sm:mt-10 [@media(max-height:720px)_and_(max-width:1023px)]:mt-3 [@media(max-height:720px)_and_(max-width:1023px)]:sm:mt-6">
                    <div className="flex w-full min-w-0 flex-col">
                      <label
                        htmlFor="additional-feedback"
                        className="text-balance text-left text-lg font-normal text-black sm:text-xl"
                      >
                        Additional feedback (optional)
                      </label>
                      <textarea
                        id="additional-feedback"
                        value={additionalFeedback}
                        onChange={(event) =>
                          setAdditionalFeedback(event.target.value)
                        }
                        rows={5}
                        className="mt-3 w-full min-h-[154px] min-w-0 max-w-full resize-y rounded-none border border-[#cbd5e1] px-4 py-3 text-base text-black outline-none focus:border-black focus:ring-2 focus:ring-inset focus:ring-black sm:px-5 sm:py-4"
                        placeholder="Share anything else that would help our team better understand your experience."
                        aria-label="Additional feedback (optional)"
                      />
                    </div>

                    <div className="mt-8 flex w-full min-w-0 flex-col gap-6 [@media(max-height:720px)_and_(max-width:1023px)]:mt-5 [@media(max-height:720px)_and_(max-width:1023px)]:gap-4">
                      <label className="flex cursor-pointer items-start gap-3 text-left">
                        <input
                          type="checkbox"
                          checked={canContact}
                          onChange={(event) =>
                            setCanContact(event.target.checked)
                          }
                          className="mt-0.5 h-5 w-5 shrink-0 accent-black rounded border-[#cbd5e1] text-black focus:ring-black"
                          aria-label="Yes, you can contact me"
                        />
                        <span className="h-full text-base leading-normal text-black">
                          Yes, you can contact me
                        </span>
                      </label>

                      <div className="flex w-full min-w-0 flex-col">
                        <label
                          htmlFor="catch-all-email"
                          className="text-balance text-left text-lg font-normal text-black sm:text-xl"
                        >
                          Email address
                          {!canContact && (
                            <span className="font-normal text-black">
                              {' '}
                              (optional)
                            </span>
                          )}
                        </label>
                        <input
                          id="catch-all-email"
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder="you@example.com"
                          aria-label={
                            canContact
                              ? 'Email address'
                              : 'Email address (optional)'
                          }
                          className="mt-3 h-12 w-full min-w-0 max-w-full rounded-none border border-[#cbd5e1] px-4 py-3 text-base text-black outline-none focus:border-black focus:ring-2 focus:ring-inset focus:ring-black sm:px-5"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex shrink-0 flex-col items-center justify-center gap-3 sm:mt-8 sm:flex-row [@media(max-height:720px)_and_(max-width:1023px)]:mt-3 [@media(max-height:720px)_and_(max-width:1023px)]:sm:mt-4">
                  <button
                    type="button"
                    onClick={handleBackCatchAll}
                    className={`${buttonBaseClass} w-[152px] shrink-0 border border-black bg-white text-black hover:bg-white hover:border-black/50 hover:text-black/50 focus-visible:outline-black`}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitClick}
                    disabled={
                      isSubmitting ||
                      (canContact && email.trim().length === 0)
                    }
                    className={`${buttonBaseClass} w-[152px] bg-black text-white enabled:hover:bg-black/75 focus-visible:outline-black disabled:cursor-not-allowed disabled:bg-black/50`}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'thank-you' && (
          <div className={stepPrimaryColumnClass}>
            <div className={`${stepProgressBandClass} justify-center`}>
              <div className="mx-auto flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-black">
                <svg
                  className="h-8 w-8 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M5 12.5L9.5 17L19 7.5"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
            <div className={stepHeadlineBandClass}>
              <div className="w-full min-w-0 max-w-[672px] px-3 text-center sm:px-4">
              <h2 className="mt-0 text-balance text-4xl font-normal text-black sm:text-5xl">Thank You</h2>
              <p className="mt-4 text-balance text-lg text-[#1e293b] sm:text-xl">
                We've heard your voice, and it will help us plan for the
                future.
              </p>
              <button
                type="button"
                onClick={resetFlow}
                disabled={welcomeOverlayBusy}
                className={`${buttonBaseClass} mx-auto mt-8 w-full max-w-[387px] bg-black text-white enabled:hover:bg-black/75 focus-visible:outline-black disabled:cursor-not-allowed disabled:opacity-60`}
              >
                RETURN TO START
              </button>
              <p className="mt-6 text-sm text-[#475569]">
                Local submissions captured: {submissions.length}
              </p>
            </div>
            </div>
          </div>
        )}
          </div>
        </div>
      </section>
    </main>
    </>
  )
}

export default App
