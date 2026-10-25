import { type ComponentProps } from "solid-js"

export const Mark = (props: { class?: string }) => {
  return (
    <svg
      data-component="logo-mark"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 16 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path data-slot="logo-brackets" d="M0 0H5V2H2V5H0V0ZM16 0H11V2H14V5H16V0ZM0 20H5V18H2V15H0V20ZM16 20H11V18H14V15H16V20Z" fill="currentColor" opacity="0.65" />
      <path data-slot="logo-mark-w" d="M3 5H5V13H7V8H9V13H11V5H13V15H3V5Z" fill="currentColor" />
    </svg>
  )
}

export const Splash = (props: Pick<ComponentProps<"svg">, "ref" | "class">) => {
  return (
    <svg
      ref={props.ref}
      data-component="logo-splash"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 80 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M0 0H25V10H10V25H0V0ZM80 0H55V10H70V25H80V0ZM0 100H25V90H10V75H0V100ZM80 100H55V90H70V75H80V100Z" fill="currentColor" opacity="0.65" />
      <path d="M15 25H25V65H35V42H45V65H55V25H65V75H15V25Z" fill="currentColor" />
    </svg>
  )
}

export const Logo = (props: { class?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 160 40"
      fill="none"
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      <g fill="currentColor">
        {/* W */}
        <path d="M8 8H16V24H22V16H28V24H34V8H42V32H8V8Z" />
        {/* H */}
        <path d="M48 8H56V17H66V8H74V32H66V23H56V32H48V8Z" />
        {/* I */}
        <path d="M80 8H98V14H92V26H98V32H80V26H86V14H80V8Z" />
        {/* S */}
        <path d="M104 8H126V18H112V22H126V32H104V22H118V18H104V8Z" />
      </g>
    </svg>
  )
}
