import { RGBA, TextAttributes } from "@opentui/core"
import { createMemo, For, type JSX } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { useTheme, useThemes } from "../context/theme"
import { tint } from "../theme/color"
import { go, logo } from "../logo"

// WHIS molten ember -> flame -> amber -> pale gold gradient banner (dark mode)
const whisDarkBannerColors = [
  RGBA.fromHex("#7A3410"),
  RGBA.fromHex("#B45A16"),
  RGBA.fromHex("#E07B1F"),
  RGBA.fromHex("#FF9F1C"),
  RGBA.fromHex("#FFB84D"),
  RGBA.fromHex("#FFD166"),
]

// WHIS amber -> flame gradient banner (light mode)
const whisLightBannerColors = [
  RGBA.fromHex("#99470E"),
  RGBA.fromHex("#B45309"),
  RGBA.fromHex("#C46831"),
  RGBA.fromHex("#D37D4C"),
  RGBA.fromHex("#E39266"),
  RGBA.fromHex("#F2A77F"),
]

export function Logo() {
  const theme = useTheme()
  const themes = useThemes()
  const dimensions = useTerminalDimensions()

  const bannerColors = createMemo(() => {
    const isWhis = !themes.selected || themes.selected === "whis"
    const isLight = themes.mode?.() === "light"
    if (isWhis) {
      return isLight ? whisLightBannerColors : whisDarkBannerColors
    }
    const interactive = theme.hue?.interactive
    if (interactive) {
      const steps = isLight
        ? ([100, 200, 300, 400, 500, 600] as const)
        : ([700, 600, 500, 400, 300, 200] as const)
      const list = steps.map((s) => interactive[s]).filter((c): c is RGBA => c !== undefined)
      if (list.length === 6) return list
    }
    return isLight ? whisLightBannerColors : whisDarkBannerColors
  })

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
            const colors = bannerColors()
            const rowColor = colors[index() % colors.length] ?? colors[0]
            return <box flexDirection="row">{renderLine(line, rowColor, true)}</box>
          }}
        </For>
      ) : dimensions().width < 44 ? (
        <>
          <For each={logo.left.slice(1)}>
            {(line, index) => {
              const colors = bannerColors()
              const rowColor = colors[index() % colors.length] ?? colors[0]
              return <box flexDirection="row">{renderLine(line, rowColor, true)}</box>
            }}
          </For>
          <For each={logo.right}>
            {(line, index) => {
              const colors = bannerColors()
              const rowColor = colors[index() % colors.length] ?? colors[0]
              return <box flexDirection="row">{renderLine(line, rowColor, true)}</box>
            }}
          </For>
        </>
      ) : (
        <For each={logo.left}>
          {(line, index) => {
            const colors = bannerColors()
            const rowColor = colors[index() % colors.length] ?? colors[0]
            return (
              <box flexDirection="row" gap={1}>
                <box flexDirection="row">{renderLine(line, rowColor, true)}</box>
                <box flexDirection="row">{renderLine(logo.right[index()], rowColor, true)}</box>
              </box>
            )
          }}
        </For>
      )}
    </box>
  )
}
