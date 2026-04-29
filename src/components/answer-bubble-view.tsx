import { useEffect, useRef, useState } from 'react'

type PeekPhase = 'loading' | 'result'

const EXPANDED_WIDTH = 268
const EXPANDED_MAX_HEIGHT = 460
const EXPANDED_TOP_PADDING = 30 // matches CSS .peek-card padding-top — clears the corner ×
const EXPANDED_BOTTOM_PADDING = 14 // matches CSS .peek-card padding-bottom

const CONFIDENCE_COLOR: Record<string, string> = {
  high: '#4ade80',
  mid: '#facc15',
  low: '#f87171',
}

function isShortAnswer(answer: string): boolean {
  return answer.trim().length <= 18
}

function collapsedLabel(answers: AnswerItem[]): string {
  if (answers.length === 0) return ''
  if (answers.length > 1) return `${answers.length} answers`
  const answer = answers[0].answer.trim()
  if (isShortAnswer(answer)) return answer
  return 'Answer ready'
}

function collapsedLayout(phase: PeekPhase, answers: AnswerItem[]) {
  if (phase === 'loading') return { width: 72, height: 36 }
  if (answers.length === 0) return { width: 72, height: 36 }
  const label = collapsedLabel(answers)
  // Width budget: label glyphs + chevron + close-X + horizontal padding.
  // Pre-v0.1.5 we used `50 + label.length * 7`; the +20 reserves room for
  // the inline close button so longer labels don't crowd it.
  return {
    width: Math.max(98, Math.min(200, 70 + label.length * 7)),
    height: 36,
  }
}

export function AnswerBubbleView() {
  const [phase, setPhase] = useState<PeekPhase>('loading')
  const [answers, setAnswers] = useState<AnswerItem[]>([])
  const [expanded, setExpanded] = useState(false)
  // Ref points to the *inner* content wrapper, NOT the scrollable body.
  // Why: `.peek-card-body` uses `flex: 1` and gets stretched to fill the
  // card's vertical space, which means its `clientHeight` and
  // `scrollHeight` track the *window* size, not the actual content. When
  // a previous expansion left the window at 244px tall, body.scrollHeight
  // would happily report ~200 even if the new (smaller) content only
  // needs 50 — and we'd never shrink. The contentRef wraps the answers
  // directly and has natural sizing, so its height *is* the content
  // height regardless of how much room flex gave the body.
  const contentRef = useRef<HTMLDivElement>(null)
  // Last layout we sent to main. ResizeObserver can fire several times for
  // the same content as the browser settles; if we re-send identical (or
  // sub-pixel-different) dimensions, electron's setBounds still triggers a
  // native resize, which fires ResizeObserver again, ad infinitum. The
  // dead-band (>=2px) absorbs harmless rounding jitter.
  const lastSentLayoutRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 })
  const dragRef = useRef({
    pointerId: -1,
    lastX: 0,
    lastY: 0,
    totalX: 0,
    totalY: 0,
    moved: false,
  })

  function pushLayout(width: number, height: number): void {
    const last = lastSentLayoutRef.current
    if (last.width === width && Math.abs(last.height - height) < 2) return
    lastSentLayoutRef.current = { width, height }
    window.snapcue.setAnswerBubbleLayout({ width, height })
  }

  useEffect(() => {
    return window.snapcue.onAnswerBubbleShow((payload) => {
      setPhase(payload.state)
      setAnswers(payload.answers ?? [])
      setExpanded(false)
      window.snapcue.setAnswerBubbleExpanded(false)
      // Each new screenshot is a fresh sizing context. If we leave the
      // previous content's stable height in the dedup cache, the new
      // content's first measurement can be silently swallowed when it
      // happens to land within the dead-band — and the window stays at
      // the previous size with empty space below. Wiping the ref forces
      // the next push to take effect.
      lastSentLayoutRef.current = { width: 0, height: 0 }
    })
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        window.snapcue.closeAnswerBubble()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Collapsed/loading: deterministic layout, push immediately.
  useEffect(() => {
    if (expanded) return
    const layout = collapsedLayout(phase, answers)
    pushLayout(layout.width, layout.height)
  }, [expanded, phase, answers])

  // Expanded: measure inner body via ResizeObserver. Why ResizeObserver and
  // not useLayoutEffect:
  //  1. The first measurement happens BEFORE the window has resized to the
  //     new expanded width, so text wraps at the old (collapsed) width and
  //     gives a wrong height. ResizeObserver fires again after CSS reflow
  //     completes at the new width, converging on the correct value.
  //  2. We measure bodyRef (not a parent) so its content height is
  //     independent of any overflow:auto on ancestors — scrollHeight on a
  //     scrollable container reports its content's true intrinsic height
  //     regardless of how much is currently visible.
  useEffect(() => {
    if (!expanded || answers.length === 0) return
    const el = contentRef.current
    if (!el) return

    // Belt-and-suspenders: also reset on every fresh expansion. Covers the
    // case where user expands → collapses → expands again on the same
    // content (no new screenshot to trigger the show-handler reset above).
    lastSentLayoutRef.current = { width: 0, height: 0 }

    const send = () => {
      // Use getBoundingClientRect for sub-pixel accuracy, then ceil up so
      // we never undersize and clip the bottom of the content.
      const contentH = Math.ceil(el.getBoundingClientRect().height)
      const total = EXPANDED_TOP_PADDING + contentH + EXPANDED_BOTTOM_PADDING
      pushLayout(EXPANDED_WIDTH, Math.min(EXPANDED_MAX_HEIGHT, total))
    }

    send()
    const observer = new ResizeObserver(send)
    observer.observe(el)
    return () => observer.disconnect()
  }, [expanded, answers])

  function toggleExpanded() {
    if (phase !== 'result' || answers.length === 0) return
    const next = !expanded
    setExpanded(next)
    window.snapcue.setAnswerBubbleExpanded(next)
  }

  function handlePointerDown(event: React.PointerEvent<HTMLElement>) {
    dragRef.current = {
      pointerId: event.pointerId,
      lastX: event.screenX,
      lastY: event.screenY,
      totalX: 0,
      totalY: 0,
      moved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current
    if (drag.pointerId !== event.pointerId) return

    const dx = event.screenX - drag.lastX
    const dy = event.screenY - drag.lastY
    if (Math.abs(dx) + Math.abs(dy) < 1) return

    drag.totalX += Math.abs(dx)
    drag.totalY += Math.abs(dy)
    drag.moved = drag.totalX + drag.totalY > 4
    drag.lastX = event.screenX
    drag.lastY = event.screenY
    window.snapcue.moveAnswerBubbleBy({ dx, dy })
  }

  function handlePointerUp(event: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current
    if (drag.pointerId !== event.pointerId) return

    const wasDrag = drag.moved
    dragRef.current.pointerId = -1

    if (wasDrag) {
      window.snapcue.saveAnswerBubbleDraggedPosition()
    } else {
      toggleExpanded()
    }
  }

  const label = collapsedLabel(answers)

  return (
    <div className="peek-stage">
      <div
        className={[
          'peek-capsule',
          phase === 'loading' ? 'is-loading' : '',
          expanded ? 'is-expanded' : '',
        ].join(' ')}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        title={
          phase === 'loading'
            ? 'Thinking'
            : expanded
              ? 'Click to collapse · Drag to move'
              : 'Click to expand · Drag to move'
        }
      >
        {phase === 'loading' ? (
          <span className="peek-thinking" aria-label="Thinking">
            <i />
            <i />
            <i />
          </span>
        ) : !expanded ? (
          <span className="peek-collapsed">
            <span className="peek-label">{label}</span>
            <span className="peek-chevron" aria-hidden="true" />
            <CloseButton variant="inline" />
          </span>
        ) : (
          <ExpandedCard answers={answers} contentRef={contentRef} />
        )}
      </div>
    </div>
  )
}

function ExpandedCard({
  answers,
  contentRef,
}: {
  answers: AnswerItem[]
  contentRef: React.RefObject<HTMLDivElement>
}) {
  const isSingle = answers.length === 1

  return (
    <div className="peek-card">
      <CloseButton variant="corner" />
      <div className="peek-card-body">
        {/* contentRef wraps actual answers and is naturally-sized — its
            height reflects rendered content, NOT the flex-stretched body.
            See AnswerBubbleView for the rationale. */}
        <div ref={contentRef} className="peek-card-content">
          {isSingle ? (
            <SingleAnswerBlock answer={answers[0]} />
          ) : (
            answers.map((a, i) => (
              <AnswerRow key={`${a.q}-${i}`} answer={a} isLast={i === answers.length - 1} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function CloseButton({ variant }: { variant: 'inline' | 'corner' }) {
  return (
    <button
      type="button"
      className={`peek-close peek-close--${variant}`}
      aria-label="Close Quick Peek"
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        window.snapcue.closeAnswerBubble()
      }}
    >
      <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
        <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  )
}

function ConfidenceDot({ confidence }: { confidence: AnswerItem['confidence'] }) {
  return (
    <span
      className="peek-conf-dot"
      style={{ background: CONFIDENCE_COLOR[confidence] ?? CONFIDENCE_COLOR['low'] }}
    />
  )
}

function SingleAnswerBlock({ answer }: { answer: AnswerItem }) {
  const text = answer.answer.trim()
  const isShort = isShortAnswer(text)

  return (
    <div className="peek-single-block">
      <div className="peek-single-headrow">
        <span className={['peek-single-text', isShort ? 'is-short' : 'is-long'].join(' ')}>
          {text}
        </span>
        <ConfidenceDot confidence={answer.confidence} />
      </div>
      {answer.reason ? <p className="peek-reason">{answer.reason}</p> : null}
    </div>
  )
}

function AnswerRow({ answer, isLast }: { answer: AnswerItem; isLast: boolean }) {
  return (
    <div className={['peek-row', isLast ? 'is-last' : ''].join(' ')}>
      <div className="peek-row-headrow">
        <span className="peek-row-q">{answer.q}</span>
        <span className="peek-row-answer">{answer.answer}</span>
        <ConfidenceDot confidence={answer.confidence} />
      </div>
      {answer.reason ? <p className="peek-reason peek-reason-indent">{answer.reason}</p> : null}
    </div>
  )
}
