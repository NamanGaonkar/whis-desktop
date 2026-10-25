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
        class="font-mono text-v2-text-text-base text-sm sm:text-base md:text-lg leading-[1.18] font-bold text-center whitespace-pre inline-block select-none"
        style={{
          "color": "var(--v2-text-text-base)",
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
