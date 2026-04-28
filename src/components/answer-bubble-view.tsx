import { useEffect, useMemo, useRef, useState } from 'react'

type PeekPhase = 'loading' | 'result'

function truncate(text: string, max: number): string {
  const clean = text.trim().replace(/\s+/g, ' ')
  if (clean.length <= max) return clean
  return `${clean.slice(0, Math.max(0, max - 3)).trimEnd()}...`
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

function expandedLines(answers: AnswerItem[]): string[] {
  if (answers.length <= 1) return []
  return answers.slice(0, 5).map((item) => `${item.q}  ${item.answer}`)
}

function peekLayout(phase: PeekPhase, answers: AnswerItem[], expanded: boolean) {
  if (phase === 'loading') return { width: 72, height: 36 }
  if (answers.length === 0) return { width: 72, height: 36 }

  if (!expanded) {
    const label = collapsedLabel(answers)
    return {
      width: Math.max(86, Math.min(172, 50 + label.length * 7)),
      height: 36,
    }
  }

  if (answers.length > 1) {
    const rows = Math.min(answers.length, 5)
    return {
      width: 214,
      height: Math.min(156, 18 + rows * 26),
    }
  }

  const answer = answers[0].answer.trim()
  if (isShortAnswer(answer)) {
    const reason = answers[0].reason ? truncate(answers[0].reason, 54) : ''
    return {
      width: reason ? 220 : Math.max(86, Math.min(168, 50 + answer.length * 8)),
      height: reason ? 64 : 46,
    }
  }

  return { width: 228, height: 78 }
}

export function AnswerBubbleView() {
  const [phase, setPhase] = useState<PeekPhase>('loading')
  const [answers, setAnswers] = useState<AnswerItem[]>([])
  const [expanded, setExpanded] = useState(false)
  const dragRef = useRef({
    pointerId: -1,
    lastX: 0,
    lastY: 0,
    totalX: 0,
    totalY: 0,
    moved: false,
  })

  useEffect(() => {
    return window.snapcue.onAnswerBubbleShow((payload) => {
      setPhase(payload.state)
      setAnswers(payload.answers ?? [])
      setExpanded(false)
      window.snapcue.setAnswerBubbleExpanded(false)
    })
  }, [])

  const layout = useMemo(() => peekLayout(phase, answers, expanded), [phase, answers, expanded])

  useEffect(() => {
    window.snapcue.setAnswerBubbleLayout(layout)
  }, [layout])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        window.snapcue.closeAnswerBubble()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const label = collapsedLabel(answers)
  const singleAnswer = answers.length === 1 ? answers[0].answer.trim() : ''
  const singleReason = answers.length === 1 ? truncate(answers[0].reason, 56) : ''
  const lines = useMemo(() => expandedLines(answers), [answers])

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

    if (!wasDrag) {
      toggleExpanded()
    }
  }

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
        title={phase === 'loading' ? 'Thinking' : 'Click to expand. Drag to move.'}
      >
        {expanded ? (
          <button
            className="peek-close-dot"
            aria-label="Close Quick Peek"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              window.snapcue.closeAnswerBubble()
            }}
          />
        ) : null}

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
          </span>
        ) : answers.length > 1 ? (
          <div className="peek-list">
            {lines.map((line, index) => (
              <div key={`${line}-${index}`} className="peek-list-row">
                {line}
              </div>
            ))}
          </div>
        ) : isShortAnswer(singleAnswer) ? (
          <div className="peek-single">
            <span className="peek-single-answer">{singleAnswer}</span>
            {singleReason ? <span className="peek-single-reason">{singleReason}</span> : null}
          </div>
        ) : (
          <div className="peek-long-answer">{truncate(singleAnswer, 118)}</div>
        )}
      </div>
    </div>
  )
}
