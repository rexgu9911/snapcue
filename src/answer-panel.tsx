interface AnswerPanelProps {
  answer: string
}

export function AnswerPanel({ answer }: AnswerPanelProps) {
  return (
    <div className="max-h-[380px] overflow-y-auto px-4 py-3">
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/90">{answer}</p>
    </div>
  )
}
