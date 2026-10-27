import { RGBA, TextAttributes } from "@opentui/core"
import { For, type JSX } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { useTheme } from "../context/theme"
import { tint } from "../theme/color"
import { go, logo } from "../logo"

// WHIS molten ember -> flame -> amber -> pale gold gradient banner
const bannerColors = ["#7A3410", "#B45A16", "#E07B1F", "#FF9F1C", "#FFB84D", "#FFD166"]

export function Logo() {
  const theme = useTheme()
  const dimensions = useTerminalDimensions()

  const renderLine = (line: string, fg: RGBA, bold: boolean): JSX.Element[] => {
    const shadow = tint(theme.background.base, fg, 0.25)
    const attrs = bold ? TextAttributes.BOLD : undefined
    return Array.from(line).map((char) => {
      if (char === "_") {
        return (
          <text fg={fg} bg={shadow} attributes={attrs} selectable={false}>
            {" "}
          </text>
        )
      }
      if (char === "^") {
        return (
          <text fg={fg} bg={shadow} attributes={attrs} selectable={false}>
            ▀
          </text>
        )
      }
      if (char === "~") {
        return (
          <text fg={shadow} attributes={attrs} selectable={false}>
            ▀
          </text>
        )
      }
      if (char === ",") {
        return (
          <text fg={shadow} attributes={attrs} selectable={false}>
            ▄
          </text>
        )
      }
      return (
        <text fg={fg} attributes={attrs} selectable={false}>
          {char}
        </text>
      )
    })
  }

  return (
    <box>
      {dimensions().height < 12 ? null : dimensions().width < 22 ? (
        <For each={go.right.slice(1)}>
          {(line, index) => {
            const rowColor = RGBA.fromHex(bannerColors[index() % bannerColors.length] as `#${string}`)
            return <box flexDirection="row">{renderLine(line, rowColor, true)}</box>
          }}
        </For>
      ) : dimensions().width < 44 ? (
        <>
          <For each={logo.left.slice(1)}>
            {(line, index) => {
              const rowColor = RGBA.fromHex(bannerColors[index() % bannerColors.length] as `#${string}`)
              const leftColor = tint(rowColor, theme.text.muted, 0.55)
              return <box flexDirection="row">{renderLine(line, leftColor, false)}</box>
            }}
          </For>
          <For each={logo.right}>
            {(line, index) => {
              const rowColor = RGBA.fromHex(bannerColors[index() % bannerColors.length] as `#${string}`)
              const rightColor = rowColor
              return <box flexDirection="row">{renderLine(line, rightColor, true)}</box>
            }}
          </For>
        </>
      ) : (
        <For each={logo.left}>
          {(line, index) => {
            const rowColor = RGBA.fromHex(bannerColors[index() % bannerColors.length] as `#${string}`)
            const leftColor = tint(rowColor, theme.text.muted, 0.55)
            const rightColor = rowColor
            return (
              <box flexDirection="row" gap={1}>
                <box flexDirection="row">{renderLine(line, leftColor, false)}</box>
                <box flexDirection="row">{renderLine(logo.right[index()], rightColor, true)}</box>
              </box>
            )
          }}
        </For>
      )}
    </box>
  )
}
