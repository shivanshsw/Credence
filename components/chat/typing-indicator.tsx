"use client"

type Props = {
  className?: string
  label?: string
}

export function TypingIndicator({ className = "", label = "Assistant is typing" }: Props) {
  return (
    <div
      className={`flex items-center gap-2 text-teal-400/90 ${className}`}
      aria-live="polite"
      aria-atomic="true"
      role="status"
    >
      <span className="sr-only">{label}</span>
      <div className="flex items-center gap-1">
        <span className="dot h-2 w-2 rounded-full bg-teal-400/90" />
        <span className="dot h-2 w-2 rounded-full bg-teal-400/90" />
        <span className="dot h-2 w-2 rounded-full bg-teal-400/90" />
      </div>

      <style jsx>{`
        .dot {
          display: inline-block;
          opacity: 0.3;
          animation: dotPulse 1.4s infinite ease-in-out;
        }
        .dot:nth-child(1) { animation-delay: 0s; }
        .dot:nth-child(2) { animation-delay: 0.15s; }
        .dot:nth-child(3) { animation-delay: 0.3s; }

        @keyframes dotPulse {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
