import { Splash, Logo } from "@opencode/ui/logo"
import type { Platform } from "@opencode/app/desktop"
import { onMount } from "solid-js"
import "./splash.css"

export function LoadingSplash(props: {
  deep: boolean
  firstLaunch: boolean
  platform: Platform
  preview: boolean
  onDrawEnd: () => void
}) {
  onMount(() => {
    props.onDrawEnd()
  })

  return (
    <div
      data-component="startup-splash"
      class="h-dvh w-screen flex flex-col items-center justify-center gap-6 select-none bg-v2-background-bg-deep"
    >
      <Splash class="w-20 h-24 text-amber-500 animate-pulse" />
      <Logo class="w-36 h-9 text-amber-400 opacity-90" />
    </div>
  )
}
