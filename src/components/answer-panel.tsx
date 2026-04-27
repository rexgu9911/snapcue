import { useState, useRef, useEffect, useCallback } from 'react'

interface AnswerPanelProps {
  answers: AnswerItem[]
  regionShortcut: string
}

const DOT_COLOR: Record<string, string> = {
  high: 'bg-green-400',
  mid: 'bg-yellow-400',
  low: 'bg-red-400',
}

export function AnswerPanel({ answers, regionShortcut }: AnswerPanelProps) {
  const [expandedQ, setExpandedQ] = useState<number | null>(null)

  if (answers.length === 0) {
    return (
      <div className="flex flex-col items-center" style={{ padding: '8px 10px' }}>
        <p style={{ fontSize: '11px', lineHeight: 1.45, color: 'rgba(255,255,255,0.35)' }}>
          no questions detected
        </p>
        <p
          className="font-mono"
          style={{
            fontSize: '11px',
            lineHeight: 1.45,
            color: 'rgba(255,255,255,0.35)',
            marginTop: '4px',
          }}
        >
          try {regionShortcut} to select the question area
        </p>
      </div>
    )
  }

  return (
    <div className="max-h-[360px] overflow-y-auto" style={{ padding: '6px 4px' }}>
      {answers.map((a) => (
        <AnswerRow
          key={a.q}
          item={a}
          expanded={expandedQ === a.q}
          onToggle={() => setExpandedQ(expandedQ === a.q ? null : a.q)}
        />
      ))}
    </div>
  )
}

/* Clipboard icon (mini SVG, 9px square) */
function CopyIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="5" y="5" width="9" height="9" rx="1.5" />
      <path d="M5 11H3.5A1.5 1.5 0 0 1 2 9.5V3.5A1.5 1.5 0 0 1 3.5 2h6A1.5 1.5 0 0 1 11 3.5V5" />
    </svg>
  )
}

/* Checkmark icon shown after successful copy */
function CheckIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 8.5l3.5 3.5L13 4" />
    </svg>
  )
}

/*
 * Click behavior:
 *   - Clicking anywhere on the row toggles expand/collapse
 *   - Copy button in the expanded area copies the full answer (stopPropagation prevents collapse)
 */
function AnswerRow({
  item,
  expanded,
  onToggle,
}: {
  item: AnswerItem
  expanded: boolean
  onToggle: () => void
}) {
  const expandRef = useRef<HTMLDivElement>(null)
  const answerTextRef = useRef<HTMLSpanElement>(null)
  const [expandHeight, setExpandHeight] = useState(0)
  const [copied, setCopied] = useState(false)
  const [wasTruncated, setWasTruncated] = useState(false)

  const hasReason = item.reason.length > 0

  // Detect whether the collapsed answer text is truncated via scrollWidth > clientWidth
  useEffect(() => {
    if (answerTextRef.current) {
      setWasTruncated(answerTextRef.current.scrollWidth > answerTextRef.current.clientWidth)
    }
  }, [item.answer])

  useEffect(() => {
    if (expandRef.current) {
      setExpandHeight(expandRef.current.scrollHeight)
    }
  }, [item.answer, item.reason, expanded, wasTruncated])

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      try {
        navigator.clipboard.writeText(item.answer)
      } catch {
        /* clipboard API may fail in some contexts — silently ignore */
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 800)
    },
    [item.answer],
  )

  return (
    <div
      className="cursor-pointer select-none transition-colors"
      style={{ padding: '4px 10px', borderRadius: '5px' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      onClick={onToggle}
    >
      {/* Collapsed row: question number | answer text | confidence dot */}
      <div className="flex items-center">
        <span
          className="shrink-0 font-mono tabular-nums"
          style={{ width: '22px', fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}
        >
          {item.q}
        </span>
        <span
          ref={answerTextRef}
          className="font-mono"
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: '11px',
            fontWeight: item.answer.length <= 10 ? 600 : 500,
            letterSpacing: '0.5px',
            color: 'rgba(255,255,255,0.95)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {item.answer}
        </span>
        <span className="shrink-0" style={{ width: '6px' }} />
        <span
          className={`shrink-0 rounded-full ${DOT_COLOR[item.confidence] ?? DOT_COLOR['low']}`}
          style={{ width: '5px', height: '5px', opacity: 0.8 }}
        />
      </div>

      {/* Expandable detail */}
      <div
        className="overflow-hidden transition-[max-height] duration-150 ease-in-out"
        style={{ maxHeight: expanded ? `${expandHeight}px` : '0px' }}
      >
        <div ref={expandRef} style={{ paddingLeft: '34px', paddingTop: '2px', paddingBottom: '4px' }}>
          {/* If answer was truncated in collapsed state, show full answer text */}
          {wasTruncated && (
            <div style={{ position: 'relative' }}>
              <p
                style={{
                  fontSize: '10px',
                  lineHeight: 1.45,
                  color: 'rgba(255,255,255,0.7)',
                  overflowWrap: 'break-word',
                  paddingRight: '16px',
                }}
              >
                {item.answer}
              </p>
              {/* Copy button — top-right of full answer block */}
              <span
                onClick={handleCopy}
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  color: copied ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.25)',
                  cursor: 'pointer',
                  transition: 'color 300ms ease',
                  padding: '0 2px',
                }}
                onMouseEnter={(e) => {
                  if (!copied) e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
                }}
                onMouseLeave={(e) => {
                  if (!copied) e.currentTarget.style.color = 'rgba(255,255,255,0.25)'
                }}
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
              </span>
            </div>
          )}

          {/* For non-truncated answers, show copy button inline after reason */}
          {!wasTruncated && (
            <div className="flex items-start" style={{ gap: '6px' }}>
              <p
                style={{
                  flex: 1,
                  fontSize: '10px',
                  lineHeight: 1.45,
                  color: 'rgba(255,255,255,0.35)',
                }}
              >
                {item.reason}
              </p>
              <span
                className="shrink-0"
                onClick={handleCopy}
                style={{
                  color: copied ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.25)',
                  cursor: 'pointer',
                  transition: 'color 300ms ease',
                  marginTop: '1px',
                }}
                onMouseEnter={(e) => {
                  if (!copied) e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
                }}
                onMouseLeave={(e) => {
                  if (!copied) e.currentTarget.style.color = 'rgba(255,255,255,0.25)'
                }}
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
              </span>
            </div>
          )}

          {/* Reason for truncated answers — with left border for visual separation */}
          {wasTruncated && hasReason && (
            <p
              style={{
                fontSize: '10px',
                lineHeight: 1.45,
                color: 'rgba(255,255,255,0.35)',
                marginTop: '8px',
                borderLeft: '1.5px solid rgba(255,255,255,0.06)',
                paddingLeft: '8px',
              }}
            >
              {item.reason}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
