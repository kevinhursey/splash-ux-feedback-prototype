import { useMemo, useState } from 'react'

import welcomeVisual from './assets/f6a77ee25998cd0c15c2b8a0d6bef7386ffd840a-5235x3490.webp'

type Step = 'welcome' | 'areas' | 'improvements' | 'detail' | 'thank-you'

type Area = {
  id: string
  title: string
  description: string
  improvements: string[]
}

type FeedbackSubmission = {
  id: string
  submittedAt: string
  selectedAreas: string[]
  improvementsByArea: Record<string, string[]>
  detailsByArea: Record<string, Record<string, string>>
}

const AREAS: Area[] = [
  {
    id: 'reporting',
    title: 'Reporting',
    description: 'Creating and formatting reports',
    improvements: [
      'Faster report and dashboard creation',
      'Improved report formatting',
      'Easier POV understanding in reports',
      'Better data visualizations for different user groups',
      'Dashboards tailored to different user groups',
    ],
  },
  {
    id: 'planning',
    title: 'Business Process Flows',
    description: 'Workflows and process management',
    improvements: [
      'Clearer processes for end users based on roles',
      'Better visibility into end user status',
      'More secure processes for different user levels',
      'Easier workflow POV management',
      'Clear distinction between required and optional steps',
    ],
  },
  {
    id: 'dashboards',
    title: 'Modeling',
    description: 'Scenario modeling and configuration',
    improvements: [
      'Easier scenario modeling in OneStream',
      'Easier transition from Excel models to OneStream',
      'Improved modeling configuration (DCS)',
      'Faster iteration on scenario models',
    ],
  },
  {
    id: 'navigation',
    title: 'Rules and Formulas',
    description: 'Writing and configuring formulas',
    improvements: [
      'Easier to find where to write rules and formulas',
      'Easier rule and formula configuration',
      'Easier creation of rules and formulas',
      'Better access to support when troubleshooting',
    ],
  },
  {
    id: 'workflows',
    title: 'Data Input',
    description: 'Forms and manual data entry',
    improvements: [
      'Easier custom form creation and publishing',
      'Easier manual data entry setup',
      'Ability to update relevant data live',
      'Better connector support for data input',
    ],
  },
  {
    id: 'data-integration',
    title: 'System Design',
    description: 'Environment and UI configuration',
    improvements: [
      'Clearer separation between environments (prod vs dev)',
      'Better control over branding and color configuration',
      'Light and dark mode support',
      'Easier dashboard and cube view search',
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
      'Improved in-app help experience',
    ],
  },
  {
    id: 'mobile',
    title: 'Configuration',
    description: 'Tools and data setup',
    improvements: [
      'Clearer guidance on which tools and solutions to use',
      'Easier data configuration',
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
  const [currentDetailIndex, setCurrentDetailIndex] = useState(0)
  const [improvementsByArea, setImprovementsByArea] = useState<
    Record<string, string[]>
  >({})
  const [detailsByArea, setDetailsByArea] = useState<
    Record<string, Record<string, string>>
  >({})
  const [submissions, setSubmissions] = useState<FeedbackSubmission[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

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
  const currentDetailImprovement = currentArea
    ? currentSelections[currentDetailIndex]
    : undefined

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
      const nextValues = selected.includes(improvement)
        ? selected.filter((item) => item !== improvement)
        : [...selected, improvement]

      return { ...previous, [areaId]: nextValues }
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

  const goToImprovementFlow = () => {
    setCurrentAreaIndex(0)
    setStep('improvements')
  }

  const handleContinueImprovements = () => {
    setCurrentDetailIndex(0)
    setStep('detail')
  }

  const handleBackImprovements = () => {
    if (currentAreaIndex === 0) {
      setStep('areas')
      return
    }

    setCurrentAreaIndex((value) => value - 1)
  }

  const handleContinueDetails = () => {
    if (currentDetailIndex < currentSelections.length - 1) {
      setCurrentDetailIndex((value) => value + 1)
      return
    }

    if (isLastImprovementScreen) {
      void handleSubmit()
      return
    }

    setCurrentAreaIndex((value) => value + 1)
    setCurrentDetailIndex(0)
    setStep('improvements')
  }

  const handleBackDetails = () => {
    if (currentDetailIndex > 0) {
      setCurrentDetailIndex((value) => value - 1)
      return
    }

    setStep('improvements')
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    const submission = await submitFeedback({
      selectedAreas,
      improvementsByArea,
      detailsByArea,
    })
    setSubmissions((previous) => [submission, ...previous])
    setIsSubmitting(false)
    setStep('thank-you')
  }

  const resetFlow = () => {
    setStep('welcome')
    setSelectedAreas([])
    setCurrentAreaIndex(0)
    setCurrentDetailIndex(0)
    setImprovementsByArea({})
    setDetailsByArea({})
  }

  const buttonBaseClass =
    'inline-flex h-12 items-center justify-center rounded-none px-6 font-["OneStreamFono"] text-xl font-normal uppercase tracking-[0.5px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2'

  const renderAreaProgress = (compact = false, emptyInner = false) => (
    <div
      className={`${compact ? 'mb-6' : 'mb-2'} ${
        emptyInner ? 'h-0 w-full' : ''
      }`}
      style={emptyInner ? { height: '0px' } : undefined}
    >
      <div
        className={`flex flex-wrap items-start justify-center ${
          compact ? 'gap-y-4' : 'gap-y-4'
        } ${emptyInner ? 'h-0' : ''}`}
      >
        {!emptyInner &&
          selectedAreaModels.map((area, index) => {
            const isCurrent = index === currentAreaIndex

            return (
              <div key={area.id} className="flex items-start">
                <div
                  className={`flex w-[112px] flex-col items-center text-center sm:w-fit ${
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

  return (
    <main className="box-border flex h-screen items-center justify-center overflow-hidden bg-[#5564ff] p-4 sm:p-8 md:p-8">
      <section
        className={`flex h-full w-full max-w-[1470px] flex-col items-center rounded-[20px] bg-white px-5 shadow-2xl sm:px-0 ${
          step === 'welcome'
            ? 'py-0 justify-start'
            : 'py-8 sm:py-12 justify-center'
        }`}
        style={{ width: '100%', height: '100%' }}
      >
        <div
          className={`flex h-full min-h-0 w-full flex-1 flex-col items-center self-stretch ${
            step === 'welcome' ? 'justify-start' : 'justify-center'
          }`}
        >
          <div
            key={step}
            className={`page-step-enter flex h-full min-h-0 w-full flex-1 flex-col items-center ${
              step === 'welcome' ? 'min-h-0 justify-start' : 'justify-center'
            }`}
          >
        {step === 'welcome' && (
          <div className="grid h-full min-h-0 w-full flex-1 grid-cols-1 items-stretch self-stretch p-0 lg:grid-cols-[1.25fr_1fr] lg:grid-rows-[minmax(0,1fr)]">
            <div className="mx-auto flex h-full w-full flex-col items-start justify-center gap-8 px-16 py-12">
              <div className="space-y-6">
                <h1 className="text-4xl leading-tight font-normal text-black md:text-5xl lg:text-[64px]">
                  Share Feedback to Improve OneStream
                </h1>
                <p className="max-w-[620px] text-lg leading-[1.4] text-black md:text-xl">
                  You can help us understand what matters most to you.
                </p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => setStep('areas')}
                  className={`${buttonBaseClass} bg-black text-white enabled:hover:bg-black/75 focus-visible:outline-black`}
                >
                  GET STARTED
                </button>
              </div>
            </div>
            <div className="relative hidden min-h-0 w-full self-stretch overflow-hidden rounded-tr-[20px] rounded-br-[20px] bg-[#f8f9ff] p-0 lg:block lg:h-full">
              <img
                src={welcomeVisual}
                alt=""
                className="block h-full w-full rounded-none object-cover object-center"
                decoding="async"
              />
            </div>
          </div>
        )}

        {step === 'areas' && (
          <div
            className="mx-auto flex h-fit w-full max-w-[1152px] flex-col items-center justify-center gap-12"
            style={{ width: '100%', height: 'fit-content' }}
          >
            <div className="mx-auto flex h-fit w-fit flex-col items-center justify-end gap-6 text-center">
              {renderAreaProgress(false, true)}
              <h2 className="mt-2 flex w-full flex-col items-center justify-start text-3xl leading-tight font-normal text-black md:text-[32px]">
                Select topics to discuss
              </h2>
            </div>

            <div
              className="mt-0 h-fit grid w-[1200px] grid-cols-1 gap-4 [&>button]:w-full sm:grid-cols-2 lg:[grid-template-columns:repeat(4,1fr)] lg:[grid-template-rows:repeat(2,1fr)]"
              style={{ width: '1200px' }}
            >
              {AREAS.map((area) => {
                const isSelected = selectedAreas.includes(area.id)

                return (
                  <button
                    key={area.id}
                    type="button"
                    onClick={() => toggleArea(area.id)}
                    className={`relative flex h-[152px] w-full flex-col items-center justify-center gap-0 rounded-none border-0 px-4 py-0 text-left outline-none ring-offset-white transition hover:-translate-y-[6px] focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 ${
                      isSelected
                        ? 'bg-white ring-2 ring-black'
                        : 'bg-[#eeeeee] hover:bg-[#d4d4d4]'
                    }`}
                  >
                    {isSelected && (
                      <span
                        className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-black font-['OneStreamFono'] text-sm text-white"
                        aria-hidden="true"
                      >
                        {selectedAreas.indexOf(area.id) + 1}
                      </span>
                    )}
                    <p className="text-[20px] text-center font-normal text-black">
                      {area.title}
                    </p>
                    <p className="mt-3 text-center text-sm leading-5 text-[#575757]">
                      {area.description}
                    </p>
                  </button>
                )
              })}
            </div>

            <div className="mt-auto flex h-20 items-center justify-end gap-4 pt-0">
              <button
                type="button"
                onClick={() => setStep('welcome')}
                className={`${buttonBaseClass} w-[152px] border border-black bg-white text-black hover:bg-white hover:border-black/50 hover:text-black/50 focus-visible:outline-black`}
              >
                Back
              </button>
              <button
                type="button"
                onClick={goToImprovementFlow}
                disabled={selectedAreas.length === 0}
                className={`${buttonBaseClass} bg-black text-white enabled:hover:bg-black/75 focus-visible:outline-black disabled:cursor-not-allowed disabled:bg-black/50`}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 'improvements' && currentArea && (
          <div className="mx-auto flex h-full min-h-0 w-full max-w-[1152px] flex-1 flex-col items-center justify-start gap-0">
            <div className="mx-auto flex w-fit flex-col gap-4 text-center">
              {renderAreaProgress()}
            </div>

            <div className="mx-auto mt-4 flex h-full w-full max-w-[1152px] flex-col items-center justify-start">
              <h2 className="mt-2 inline-block w-fit text-center text-3xl leading-tight font-normal text-black md:text-[32px]">
                Select all {currentArea.title.toLowerCase()} topics you&apos;d like to discuss
              </h2>
              <div className="mt-10 h-fit w-full flex flex-col justify-center gap-3">
                {currentArea.improvements.map((improvement) => {
                  const isSelected = currentSelections.includes(improvement)

                  return (
                    <button
                      key={improvement}
                      type="button"
                      onClick={() =>
                        toggleImprovement(currentArea.id, improvement)
                      }
                      className={`flex min-h-[70px] items-center justify-between gap-4 rounded-none border-0 px-5 py-4 text-left outline-none ring-offset-white transition focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 ${
                        isSelected
                          ? 'bg-white ring-2 ring-black'
                          : 'bg-[#eeeeee] hover:translate-x-[6px] hover:bg-[#d4d4d4]'
                      }`}
                    >
                      <span className="text-lg text-black">{improvement}</span>
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

            <div className="mt-auto flex justify-center gap-3 pt-0">
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
                className={`${buttonBaseClass} bg-black text-white enabled:hover:bg-black/75 focus-visible:outline-black disabled:cursor-not-allowed disabled:bg-black/50`}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 'detail' && currentArea && currentDetailImprovement && (
          <div className="mx-auto flex h-full w-full max-w-[768px] flex-col items-center justify-start gap-6">
            {renderAreaProgress(true)}
            <div className="w-full rounded-2xl border border-[#d9deef] p-6 sm:p-10">
              <p className="text-sm uppercase font-['OneStreamFono'] text-[#475569]">
                {currentArea.title}
              </p>
              <h2 className="mt-2 text-3xl font-normal text-black">
                {currentDetailImprovement}
              </h2>
              <label htmlFor="detail" className="mt-8 block text-lg text-black">
                What would make this better? (optional)
              </label>
              <textarea
                id="detail"
                value={detailsByArea[currentArea.id]?.[currentDetailImprovement] ?? ''}
                onChange={(event) =>
                  handleImprovementDetailChange(
                    currentArea.id,
                    currentDetailImprovement,
                    event.target.value,
                  )
                }
                className="mt-3 h-56 w-full resize-none rounded-xl border border-[#cbd5e1] px-5 py-4 text-base text-black outline-none focus:border-black focus:ring-2 focus:ring-black"
                placeholder="Share any details that would help our team."
              />

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
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
                  className={`${buttonBaseClass} w-full bg-black text-white enabled:hover:bg-black/75 focus-visible:outline-black disabled:cursor-not-allowed disabled:bg-black/50`}
                >
                  {currentDetailIndex < currentSelections.length - 1
                    ? 'Continue'
                    : isLastImprovementScreen
                      ? isSubmitting
                        ? 'Submitting...'
                        : 'Submit'
                      : 'Next Area'}
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'thank-you' && (
          <div className="mx-auto flex h-full max-w-[1152px] items-center justify-center">
            <div className="w-full max-w-[672px] text-center">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-black">
                <svg
                  className="h-12 w-12 text-white"
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
              <h2 className="mt-6 text-5xl font-normal text-black">Thank You</h2>
              <p className="mt-4 text-xl text-[#1e293b]">
                We&apos;ve heard your voice, and it will help us plan for the
                future.
              </p>
              <button
                type="button"
                onClick={resetFlow}
                className={`${buttonBaseClass} mt-8 w-full max-w-[387px] bg-black text-white enabled:hover:bg-black/75 focus-visible:outline-black`}
              >
                RETURN TO START
              </button>
              <p className="mt-6 text-sm text-[#475569]">
                Local submissions captured: {submissions.length}
              </p>
            </div>
          </div>
        )}
          </div>
        </div>
      </section>
    </main>
  )
}

export default App
