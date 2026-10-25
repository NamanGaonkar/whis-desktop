import { Splash } from "@opencode/ui/logo"
import type { Platform } from "@opencode/app/desktop"
import { onMount } from "solid-js"
import "./splash.css"

export function LoadingSplash(props: {
  firstLaunch: boolean
  deep: boolean
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
      class="h-dvh w-screen flex flex-col items-center justify-center select-none bg-v2-background-bg-deep"
    >
      <Splash class="w-24 h-28 text-amber-500 animate-pulse" />
    </div>
  )
}
