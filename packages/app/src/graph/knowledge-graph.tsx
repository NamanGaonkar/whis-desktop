import {
  Component,
  createEffect,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js"
import cytoscape, { type Core, type EventObject } from "cytoscape"
import { Icon } from "@opencode/ui/icon"
import { IconButton } from "@opencode/ui/icon-button"
import { Button } from "@opencode/ui/button"
import { useTheme } from "@opencode/ui/theme"
import { useServerSDK } from "@/runtime/server/client"
import { scanCodebaseGraph, type GraphData, type GraphNode } from "./scanner"

const KIND_COLORS: Record<string, string> = {
  component: "#38bdf8",
  module: "#e5a93c",
  server: "#f43f5e",
  config: "#10b981",
  type: "#a855f7",
}

const KIND_LABELS: Record<string, string> = {
  component: "UI Component",
  module: "Logic Module",
  server: "Server / Route",
  config: "Configuration",
  type: "Type Definition",
}

export const CodebaseKnowledgeGraph: Component<{
  directory?: string
  onSelectModule?: (filePath: string, promptText?: string) => void
  onClose?: () => void
}> = (props) => {
  const client = useServerSDK()
  const theme = useTheme()
  const isDark = () => {
    try {
      return theme.mode() === "dark"
    } catch {
      return true
    }
  }

  let containerRef: HTMLDivElement | undefined
  let cy: Core | null = null
  let resizeObserver: ResizeObserver | null = null

  const [loading, setLoading] = createSignal(true)
  const [graphData, setGraphData] = createSignal<GraphData>({
    nodes: [],
    edges: [],
    fileCount: 0,
    dependencyCount: 0,
  })
  const [selectedNode, setSelectedNode] = createSignal<GraphNode["data"] | null>(null)
  const [searchQuery, setSearchQuery] = createSignal("")
  const [activeFilter, setActiveFilter] = createSignal<string>("all")

  async function loadGraph() {
    setLoading(true)
    try {
      const data = await scanCodebaseGraph(client.api, props.directory)
      setGraphData(data)
      setLoading(false)
      setTimeout(() => {
        initCytoscape(data)
      }, 50)
    } catch (err) {
      console.warn("Failed to load codebase graph:", err)
      setLoading(false)
    }
  }

  function initCytoscape(data: GraphData) {
    if (!containerRef) return

    if (cy) {
      cy.destroy()
      cy = null
    }

    const dark = isDark()
    const nodeBg = dark ? "#181410" : "#ffffff"
    const nodeText = dark ? "#ede6dd" : "#241e15"
    // Brighter connecting lines in both themes (warm amber gold in dark, rich caramel bronze in light)
    const edgeColor = dark ? "#d9a043" : "#8c672b"
    const accentColor = "#e5a93c" // Whis gold

    const formattedNodes = data.nodes.map((node) => {
      const kind = node.data.kind ?? "module"
      const color = KIND_COLORS[kind] ?? accentColor
      const size = Math.max(26, Math.min(48, 26 + (node.data.degree ?? 0) * 3))

      return {
        ...node,
        data: {
          ...node.data,
          color,
          size,
        },
      }
    })

    const elements = [...formattedNodes, ...data.edges]

    cy = cytoscape({
      container: containerRef,
      elements,
      boxSelectionEnabled: false,
      autounselectify: false,
      // Snappy and responsive mouse wheel scrolling
      wheelSensitivity: 1.2,
      minZoom: 0.15,
      maxZoom: 3.5,
      layout: {
        name: "cose",
        animate: true,
        animationDuration: 600,
        nodeRepulsion: () => 65000,
        nodeOverlap: 40,
        idealEdgeLength: () => 140,
        edgeElasticity: () => 100,
        nestingFactor: 1.2,
        gravity: 30,
        numIter: 400,
        coolingFactor: 0.95,
        padding: 40,
      },
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "font-family": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            "font-size": 11,
            "font-weight": "500",
            "text-valign": "bottom",
            "text-margin-y": 6,
            "text-max-width": "90px",
            "text-wrap": "ellipsis",
            "text-overflow-wrap": "anywhere",
            color: nodeText,
            "background-color": "data(color)",
            width: "data(size)",
            height: "data(size)",
            "border-width": 2,
            "border-color": nodeBg,
            "transition-property": "background-color, border-color, width, height, opacity",
            "transition-duration": 200,
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 3,
            "border-color": accentColor,
            "background-color": accentColor,
            color: accentColor,
            "font-weight": "bold",
            "font-size": 12,
          },
        },
        {
          selector: "edge",
          style: {
            width: 1.8,
            "line-color": edgeColor,
            "target-arrow-color": edgeColor,
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            opacity: 0.85,
            "arrow-scale": 0.9,
            "transition-property": "line-color, target-arrow-color, width, opacity",
            "transition-duration": 200,
          },
        },
        {
          selector: "edge:selected",
          style: {
            width: 3.0,
            "line-color": dark ? "#ffd166" : "#b47818",
            "target-arrow-color": dark ? "#ffd166" : "#b47818",
            opacity: 1,
          },
        },
      ],
    })

    cy.on("tap", "node", (event: EventObject) => {
      const node = event.target
      setSelectedNode(node.data())

      if (cy) {
        const neighborhood = node.neighborhood().add(node)
        cy.elements().style({ opacity: 0.25 })
        neighborhood.style({ opacity: 1 })
        const highlightColor = isDark() ? "#ffd166" : "#b47818"
        node.connectedEdges().style({ "line-color": highlightColor, "target-arrow-color": highlightColor, width: 2.5, opacity: 1 })
      }
    })

    cy.on("tap", (event: EventObject) => {
      if (event.target === cy) {
        setSelectedNode(null)
        if (cy) {
          cy.elements().style({ opacity: 1 })
          const normalColor = isDark() ? "#d9a043" : "#8c672b"
          cy.edges().style({ width: 1.8, "line-color": normalColor, "target-arrow-color": normalColor, opacity: 0.85 })
        }
      }
    })

    cy.resize()
    cy.fit(undefined, 40)
  }

  // Reactive theme synchronizer for Cytoscape canvas colors
  createEffect(() => {
    const dark = isDark()
    if (!cy) return
    const curEdgeColor = dark ? "#d9a043" : "#8c672b"
    const curSelectedEdgeColor = dark ? "#ffd166" : "#b47818"
    const curNodeText = dark ? "#ede6dd" : "#241e15"
    const curNodeBg = dark ? "#181410" : "#ffffff"

    cy.style()
      .selector("node")
      .style({
        color: curNodeText,
        "border-color": curNodeBg,
      })
      .selector("edge")
      .style({
        "line-color": curEdgeColor,
        "target-arrow-color": curEdgeColor,
        opacity: 0.85,
        width: 1.8,
      })
      .selector("edge:selected")
      .style({
        "line-color": curSelectedEdgeColor,
        "target-arrow-color": curSelectedEdgeColor,
        opacity: 1,
        width: 3.0,
      })
      .update()
  })

  function handleSearch(query: string) {
    setSearchQuery(query)
    if (!cy) return

    if (!query.trim()) {
      cy.elements().style({ opacity: 1 })
      return
    }

    const lower = query.toLowerCase()
    const matched = cy.nodes().filter((n) => {
      const label = (n.data("label") || "").toLowerCase()
      const path = (n.data("path") || "").toLowerCase()
      return label.includes(lower) || path.includes(lower)
    })

    if (matched.length > 0) {
      cy.elements().style({ opacity: 0.2 })
      matched.style({ opacity: 1 })
      matched.connectedEdges().style({ opacity: 0.85 })

      cy.animate({
        center: { eles: matched.first() },
        zoom: 1.4,
        duration: 350,
      })
      matched.first().select()
      setSelectedNode(matched.first().data())
    }
  }

  function filterByKind(kind: string) {
    setActiveFilter(kind)
    if (!cy) return

    if (kind === "all") {
      cy.elements().style({ opacity: 1 })
      return
    }

    const matched = cy.nodes().filter((n) => n.data("kind") === kind)
    cy.elements().style({ opacity: 0.2 })
    matched.style({ opacity: 1 })
    matched.connectedEdges().style({ opacity: 0.85 })
  }

  function zoomIn() {
    cy?.zoom({ level: (cy.zoom() || 1) * 1.3, position: { x: cy.width() / 2, y: cy.height() / 2 } })
  }

  function zoomOut() {
    cy?.zoom({ level: (cy.zoom() || 1) * 0.7, position: { x: cy.width() / 2, y: cy.height() / 2 } })
  }

  function fitView() {
    cy?.fit(undefined, 40)
  }

  function handleAskWhis(node: GraphNode["data"]) {
    const prompt = `Can you explain the structure, purpose, and responsibilities of @${node.path} and how it connects with other modules in this project?`
    props.onSelectModule?.(node.path, prompt)
  }

  function handleMentionInChat(node: GraphNode["data"]) {
    const prompt = `@${node.path} `
    props.onSelectModule?.(node.path, prompt)
  }

  onMount(() => {
    void loadGraph()

    if (containerRef && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        if (cy && containerRef && containerRef.clientWidth > 0 && containerRef.clientHeight > 0) {
          cy.resize()
        }
      })
      resizeObserver.observe(containerRef)
    }
  })

  onCleanup(() => {
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    if (cy) {
      cy.destroy()
      cy = null
    }
  })

  return (
    <div
      class="relative w-full h-full flex flex-col overflow-hidden select-none transition-colors duration-200"
      classList={{
        "bg-[#080502] text-[#ede6dd]": isDark(),
        "bg-[#fcfbfa] text-[#1f1912]": !isDark(),
      }}
    >
      {/* Top Glassmorphic Navigation Bar */}
      <div
        class="absolute top-2.5 left-3 right-3 z-30 flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-1.5 shadow-md backdrop-blur-md border transition-colors duration-200"
        classList={{
          "bg-[#140f0a]/90 border-[#261f17]": isDark(),
          "bg-[#ffffff]/90 border-[#e5dcce] shadow-sm": !isDark(),
        }}
      >
        <div class="flex items-center gap-2.5">
          <div class="flex items-center gap-1.5 text-xs font-semibold text-[#e5a93c] tracking-wide uppercase">
            <Icon name="graph" size="small" />
            <span>Codebase Topology</span>
          </div>

          {/* Search box */}
          <div class="relative flex items-center">
            <Icon
              name="magnifying-glass"
              size="small"
              class="absolute left-2 pointer-events-none"
              classList={{
                "text-[#7d7162]": isDark(),
                "text-[#8c7f70]": !isDark(),
              }}
            />
            <input
              type="text"
              placeholder="Search modules..."
              value={searchQuery()}
              onInput={(e) => handleSearch(e.currentTarget.value)}
              class="h-7 w-36 sm:w-48 rounded-md ps-7 pe-2 text-xs border focus:outline-none focus:border-[#e5a93c] transition-colors"
              classList={{
                "bg-[#18130e] text-[#ede6dd] placeholder:text-[#7d7162] border-[#2c2217]": isDark(),
                "bg-[#f4efe8] text-[#1f1912] placeholder:text-[#8c7f70] border-[#ded3c3]": !isDark(),
              }}
            />
          </div>

          {/* Quick filter chips */}
          <div class="hidden md:flex items-center gap-1 text-[11px]">
            <button
              type="button"
              class="px-2 py-0.5 rounded transition-colors"
              classList={{
                "bg-[#e5a93c]/20 text-[#e5a93c] font-medium": activeFilter() === "all",
                "text-[#7d7162] hover:text-[#ede6dd]": activeFilter() !== "all" && isDark(),
                "text-[#706456] hover:text-[#1f1912]": activeFilter() !== "all" && !isDark(),
              }}
              onClick={() => filterByKind("all")}
            >
              All
            </button>
            <button
              type="button"
              class="px-2 py-0.5 rounded transition-colors flex items-center gap-1"
              classList={{
                "bg-[#38bdf8]/20 text-[#38bdf8] font-medium": activeFilter() === "component",
                "text-[#7d7162] hover:text-[#ede6dd]": activeFilter() !== "component" && isDark(),
                "text-[#706456] hover:text-[#1f1912]": activeFilter() !== "component" && !isDark(),
              }}
              onClick={() => filterByKind("component")}
            >
              <span class="w-1.5 h-1.5 rounded-full bg-[#38bdf8]" />
              UI
            </button>
            <button
              type="button"
              class="px-2 py-0.5 rounded transition-colors flex items-center gap-1"
              classList={{
                "bg-[#e5a93c]/20 text-[#e5a93c] font-medium": activeFilter() === "module",
                "text-[#7d7162] hover:text-[#ede6dd]": activeFilter() !== "module" && isDark(),
                "text-[#706456] hover:text-[#1f1912]": activeFilter() !== "module" && !isDark(),
              }}
              onClick={() => filterByKind("module")}
            >
              <span class="w-1.5 h-1.5 rounded-full bg-[#e5a93c]" />
              Logic
            </button>
            <button
              type="button"
              class="px-2 py-0.5 rounded transition-colors flex items-center gap-1"
              classList={{
                "bg-[#f43f5e]/20 text-[#f43f5e] font-medium": activeFilter() === "server",
                "text-[#7d7162] hover:text-[#ede6dd]": activeFilter() !== "server" && isDark(),
                "text-[#706456] hover:text-[#1f1912]": activeFilter() !== "server" && !isDark(),
              }}
              onClick={() => filterByKind("server")}
            >
              <span class="w-1.5 h-1.5 rounded-full bg-[#f43f5e]" />
              Server
            </button>
            <button
              type="button"
              class="px-2 py-0.5 rounded transition-colors flex items-center gap-1"
              classList={{
                "bg-[#10b981]/20 text-[#10b981] font-medium": activeFilter() === "config",
                "text-[#7d7162] hover:text-[#ede6dd]": activeFilter() !== "config" && isDark(),
                "text-[#706456] hover:text-[#1f1912]": activeFilter() !== "config" && !isDark(),
              }}
              onClick={() => filterByKind("config")}
            >
              <span class="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
              Config
            </button>
          </div>
        </div>

        {/* Right Controls */}
        <div class="flex items-center gap-2">
          <span
            class="text-[11px] font-mono"
            classList={{
              "text-[#7d7162]": isDark(),
              "text-[#807466]": !isDark(),
            }}
          >
            {graphData().fileCount} files · {graphData().dependencyCount} links
          </span>
          <div
            class="flex items-center border-s ps-1.5 gap-0.5"
            classList={{
              "border-[#2c2217]": isDark(),
              "border-[#ded3c3]": !isDark(),
            }}
          >
            <IconButton
              icon={<Icon name="plus" size="small" />}
              size="small"
              variant="ghost-muted"
              aria-label="Zoom in"
              onClick={zoomIn}
            />
            <IconButton
              icon={<Icon name="minus" size="small" />}
              size="small"
              variant="ghost-muted"
              aria-label="Zoom out"
              onClick={zoomOut}
            />
            <IconButton
              icon={<Icon name="square-split-horizontal" size="small" />}
              size="small"
              variant="ghost-muted"
              aria-label="Fit view"
              onClick={fitView}
            />
            <IconButton
              icon={<Icon name="arrow-clockwise" size="small" />}
              size="small"
              variant="ghost-muted"
              aria-label="Reload graph"
              onClick={loadGraph}
            />
          </div>
        </div>
      </div>

      {/* Main Cytoscape Graph Canvas */}
      <div class="relative w-full h-full flex-1">
        <Show when={loading()}>
          <div
            class="absolute inset-0 z-20 flex flex-col items-center justify-center backdrop-blur-sm"
            classList={{
              "bg-[#080502]/80": isDark(),
              "bg-[#fcfbfa]/80": !isDark(),
            }}
          >
            <div class="w-6 h-6 border-2 border-[#e5a93c] border-t-transparent rounded-full animate-spin mb-2" />
            <span
              class="text-xs font-mono"
              classList={{
                "text-[#a59a8c]": isDark(),
                "text-[#635748]": !isDark(),
              }}
            >
              Analyzing codebase topology...
            </span>
          </div>
        </Show>

        <div ref={containerRef} class="w-full h-full cursor-grab active:cursor-grabbing" />
      </div>

      {/* Floating Node Inspection Card */}
      <Show when={selectedNode()}>
        {(node) => (
          <div
            class="absolute bottom-4 right-4 z-30 w-80 max-w-[calc(100vw-2rem)] rounded-xl border p-4 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200"
            classList={{
              "bg-[#140f0a]/95 border-[#30261c] text-[#ede6dd]": isDark(),
              "bg-[#ffffff]/95 border-[#e5dcce] text-[#1f1912] shadow-xl": !isDark(),
            }}
          >
            <div class="flex items-start justify-between gap-2 mb-2">
              <div class="min-w-0">
                <div class="flex items-center gap-1.5 mb-1">
                  <span
                    class="w-2 h-2 rounded-full shrink-0"
                    style={{ "background-color": KIND_COLORS[node().kind ?? "module"] ?? "#e5a93c" }}
                  />
                  <span
                    class="text-xs font-mono font-semibold truncate"
                    classList={{
                      "text-[#ede6dd]": isDark(),
                      "text-[#1f1912]": !isDark(),
                    }}
                  >
                    {node().label}
                  </span>
                </div>
                <span
                  class="text-[10px] font-mono block truncate"
                  title={node().path}
                  classList={{
                    "text-[#7d7162]": isDark(),
                    "text-[#807466]": !isDark(),
                  }}
                >
                  {node().path}
                </span>
              </div>
              <IconButton
                icon={<Icon name="xmark" size="small" />}
                size="small"
                variant="ghost-muted"
                aria-label="Close details"
                onClick={() => setSelectedNode(null)}
              />
            </div>

            <div class="flex items-center gap-1.5 mb-3">
              <span
                class="px-2 py-0.5 rounded text-[10px] font-mono font-medium"
                style={{
                  "background-color": `${KIND_COLORS[node().kind ?? "module"] ?? "#e5a93c"}20`,
                  color: KIND_COLORS[node().kind ?? "module"] ?? "#e5a93c",
                }}
              >
                {KIND_LABELS[node().kind ?? "module"] ?? "Module"}
              </span>
              <span
                class="text-[10px] font-mono"
                classList={{
                  "text-[#7d7162]": isDark(),
                  "text-[#807466]": !isDark(),
                }}
              >
                {node().dependencies?.length ?? 0} imports · {node().dependents?.length ?? 0} callers
              </span>
            </div>

            {/* Exported symbols */}
            <Show when={(node().symbols?.length ?? 0) > 0}>
              <div class="mb-3">
                <span
                  class="text-[10px] font-mono block mb-1 uppercase tracking-wider"
                  classList={{
                    "text-[#7d7162]": isDark(),
                    "text-[#807466]": !isDark(),
                  }}
                >
                  Exported Symbols
                </span>
                <div class="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                  <For each={node().symbols}>
                    {(sym) => (
                      <span
                        class="px-1.5 py-0.5 rounded text-[10px] font-mono border"
                        classList={{
                          "bg-[#1c1610] text-[#ede6dd] border-[#2c2217]": isDark(),
                          "bg-[#f4efe8] text-[#1f1912] border-[#ded3c3]": !isDark(),
                        }}
                      >
                        {sym}
                      </span>
                    )}
                  </For>
                </div>
              </div>
            </Show>

            {/* Action buttons */}
            <div
              class="flex flex-col gap-1.5 pt-1 border-t"
              classList={{
                "border-[#261f17]": isDark(),
                "border-[#ded3c3]": !isDark(),
              }}
            >
              <Button
                type="button"
                variant="primary"
                size="small"
                class="w-full justify-center gap-1.5 bg-[#e5a93c] text-[#080502] font-semibold hover:bg-[#d4962c]"
                onClick={() => handleAskWhis(node())}
              >
                <Icon name="bubble-5" size="small" />
                <span>Ask Whis about this</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="small"
                class="w-full justify-center gap-1.5 text-xs transition-colors"
                classList={{
                  "text-[#a59a8c] border-[#2c2217] hover:text-[#ede6dd] hover:bg-[#1c1610]": isDark(),
                  "text-[#635748] border-[#ded3c3] hover:text-[#1f1912] hover:bg-[#f4efe8]": !isDark(),
                }}
                onClick={() => handleMentionInChat(node())}
              >
                <Icon name="at" size="small" />
                <span>Mention in Chat</span>
              </Button>
            </div>
          </div>
        )}
      </Show>
    </div>
  )
}
