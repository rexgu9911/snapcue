import { useState, useRef, useEffect } from 'react'

interface AnswerPanelProps {
  answers: AnswerItem[]
}

const DOT_COLOR: Record<string, string> = {
  high: 'bg-green-400',
  mid: 'bg-yellow-400',
  low: 'bg-red-400',
}

export function AnswerPanel({ answers }: AnswerPanelProps) {
  const [expandedQ, setExpandedQ] = useState<number | null>(null)

  if (answers.length === 0) return null

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

function AnswerRow({
  item,
  expanded,
  onToggle,
}: {
  item: AnswerItem
  expanded: boolean
  onToggle: () => void
}) {
  const reasonRef = useRef<HTMLDivElement>(null)
  const [reasonHeight, setReasonHeight] = useState(0)
  useEffect(() => {
    if (reasonRef.current) {
      setReasonHeight(reasonRef.current.scrollHeight)
    }
  }, [item.reason])

  return (
    <div
      className="cursor-pointer select-none transition-colors"
      style={{ padding: '5px 10px', borderRadius: '5px' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      onClick={onToggle}
    >
      {/* Main row */}
      <div className="flex items-center">
        <span
          className="shrink-0 font-mono tabular-nums"
          style={{ width: '22px', fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}
        >
          {item.q}
        </span>
        <span
          className="shrink-0 font-mono"
          style={{
            width: '22px',
            fontSize: '14px',
            fontWeight: 600,
            letterSpacing: '0.5px',
            color: 'rgba(255,255,255,0.95)',
          }}
        >
          {item.answer}
        </span>
        <span className="flex-1" />
        <span
          className={`shrink-0 rounded-full ${DOT_COLOR[item.confidence] ?? DOT_COLOR['low']}`}
          style={{ width: '5px', height: '5px', opacity: 0.8 }}
        />
      </div>

      {/* Expandable reason */}
      <div
        className="overflow-hidden transition-[max-height] duration-150 ease-in-out"
        style={{ maxHeight: expanded ? `${reasonHeight}px` : '0px' }}
      >
        <div ref={reasonRef} style={{ paddingLeft: '34px', paddingTop: '4px' }}>
          <p style={{ fontSize: '11px', lineHeight: 1.45, color: 'rgba(255,255,255,0.35)' }}>
            {item.reason}
          </p>
        </div>
      </div>
    </div>
  )
}
