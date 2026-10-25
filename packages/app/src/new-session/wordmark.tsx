import "./wordmark.css"

const WHIS_ART = `██╗    ██╗██╗  ██╗██╗███████╗
██║    ██║██║  ██║██║██╔════╝
██║ █╗ ██║███████║██║███████╗
██║███╗██║██╔══██║██║╚════██║
╚███╔███╔╝██║  ██║██║███████║
 ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝╚══════╝`

export function NewSessionWordmark() {
  return (
    <div
      data-component="new-session-wordmark"
      aria-hidden="true"
      class="pointer-events-none mx-auto w-full flex flex-col items-center justify-center text-center select-none"
    >
      <pre
        class="font-mono text-amber-500 dark:text-amber-400 text-sm sm:text-base md:text-lg leading-[1.18] font-bold text-center whitespace-pre inline-block select-none drop-shadow-[0_0_16px_rgba(245,158,11,0.35)]"
        style={{
          "font-family": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace",
          "text-align": "center",
          "margin": "0 auto",
        }}
      >
        {WHIS_ART}
      </pre>
    </div>
  )
}
