import { createUniqueId, type ComponentProps } from "solid-js"

export function Wordmark(
  props: Pick<ComponentProps<"svg">, "class"> & { fade?: boolean; muted?: boolean; outline?: boolean },
) {
  const mask = createUniqueId()
  const maskGradient = createUniqueId()

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 720 129"
      fill="none"
      classList={{
        [props.class ?? ""]: !!props.class,
        "overflow-visible [&_path]:[vector-effect:non-scaling-stroke]": props.outline,
      }}
    >
      <g opacity={props.muted === false ? 1 : 0.6} class="[[data-color-scheme=dark]_&]:opacity-100">
        <g mask={props.fade === false ? undefined : `url(#${mask})`}>
          <g
            opacity={props.muted === false ? 1 : 0.16 * 0.7}
            fill={props.outline ? "none" : "currentColor"}
            stroke={props.outline ? "currentColor" : undefined}
            stroke-width={props.outline ? 1 : undefined}
          >
            {/* W */}
            <path
              pathLength={props.outline ? 1 : undefined}
              d="M40 18 H76 V80 H112 V50 H148 V80 H184 V18 H220 V110 H40 Z"
            />
            {/* H */}
            <path
              pathLength={props.outline ? 1 : undefined}
              d="M260 18 H296 V50 H344 V18 H380 V110 H344 V78 H296 V110 H260 Z"
            />
            {/* I */}
            <path
              pathLength={props.outline ? 1 : undefined}
              d="M410 18 H490 V44 H468 V84 H490 V110 H410 V84 H432 V44 H410 Z"
            />
            {/* S */}
            <path
              pathLength={props.outline ? 1 : undefined}
              d="M530 18 H670 V64 H566 V82 H670 V110 H530 V64 H634 V46 H530 Z"
            />
          </g>
        </g>
      </g>
      <defs>
        <mask id={mask} style="mask-type:alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="720" height="129">
          <rect width="720" height="129" fill={`url(#${maskGradient})`} />
        </mask>
        <linearGradient id={maskGradient} x1="360" y1="68" x2="360" y2="129" gradientUnits="userSpaceOnUse">
          <stop stop-color="white" stop-opacity="0.7" />
          <stop offset="1" stop-color="white" stop-opacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}
