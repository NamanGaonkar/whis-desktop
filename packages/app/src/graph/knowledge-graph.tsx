import {
  Component,
  createSignal,
  onCleanup,
  onMount,
  Show,
  For,
} from "solid-js"
import cytoscape, { type Core, type EventObject } from "cytoscape"
import { Icon } from "@opencode/ui/icon"
import { IconButton } from "@opencode/ui/icon-button"
import { Button } from "@opencode/ui/button"
import { useServerSDK } from "@/runtime/server/client"
import { scanCodebaseGraph, type GraphData, type GraphNode } from "./scanner"

const KIND_COLORS: Record<string, string> = {
  component: "#38bdf8",
  module: "#e5a93c",
  server: "#f43f5e",
  config: "#10b981",
  type: "#a855f7",
}

export const CodebaseKnowledgeGraph: Component<{
  directory?: string
  onSelectModule?: (filePath: string) => void
  onClose?: () => void
}> = (props) => {
  const client = useServerSDK()
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
      // Small timeout allows DOM to compute dimensions before Cytoscape initializes
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

    const isDark = typeof document !== "undefined" && !document.documentElement.classList.contains("light")

    const nodeBg = isDark ? "#24201b" : "#fdfbf7"
    const nodeText = isDark ? "#ede6dd" : "#2a241c"
    const edgeColor = isDark ? "#3f362a" : "#d4c8b8"
    const accentColor = "#e5a93c" // Whis gold

    // Format elements with styling attributes
    const formattedNodes = data.nodes.map((node) => {
      const kind = node.data.kind ?? "module"
      const color = KIND_COLORS[kind] ?? accentColor
      const size = Math.max(26, Math.min(46, 26 + (node.data.degree ?? 0) * 3))

      return {
        data: {
          ...node.data,
          borderColor: color,
          nodeBg,
          nodeSize: size,
        },
      }
    })

    cy = cytoscape({
      container: containerRef,
      elements: [...formattedNodes, ...data.edges],
      layout: {
        name: "cose",
        animate: true,
        animationDuration: 600,
        randomize: false,
        nodeRepulsion: () => 12000,
        idealEdgeLength: () => 80,
        edgeElasticity: () => 100,
        nestingFactor: 1.2,
      },
      style: [
        {
          selector: "node",
          style: {
            "background-color": "data(nodeBg)",
            "border-color": "data(borderColor)",
            "border-width": 2,
            label: "data(label)",
            color: nodeText,
            "font-size": "10px",
            "font-family": "var(--font-family-mono, monospace)",
            "text-valign": "bottom",
            "text-margin-y": 5,
            width: "data(nodeSize)",
            height: "data(nodeSize)",
            shape: "round-rectangle",
            "transition-property": "opacity, border-width, border-color, background-color",
            "transition-duration": 0.2,
          },
        },
        {
          selector: "node:selected",
          style: {
            "background-color": accentColor,
            "border-color": "#ffffff",
            "border-width": 3,
            color: accentColor,
            "font-weight": "bold",
          },
        },
        {
          selector: "edge",
          style: {
            width: 1.2,
            "line-color": edgeColor,
            "target-arrow-color": edgeColor,
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            "arrow-scale": 0.75,
            opacity: 0.75,
            "transition-property": "line-color, width, opacity",
            "transition-duration": 0.2,
          },
        },
        {
          selector: "edge:selected",
          style: {
            width: 2.5,
            "line-color": accentColor,
            "target-arrow-color": accentColor,
            opacity: 1,
          },
        },
      ],
    })

    cy.on("tap", "node", (event: EventObject) => {
      const node = event.target
      setSelectedNode(node.data())

      // Highlight immediate neighborhood and dim others
      if (cy) {
        const neighborhood = node.neighborhood().add(node)
        cy.elements().style({ opacity: 0.25 })
        neighborhood.style({ opacity: 1 })
        node.connectedEdges().style({ "line-color": accentColor, "target-arrow-color": accentColor, width: 2 })
      }
    })

    cy.on("tap", (event: EventObject) => {
      if (event.target === cy) {
        setSelectedNode(null)
        if (cy) {
          cy.elements().style({ opacity: 1 })
          cy.edges().style({ width: 1.2, "line-color": edgeColor, "target-arrow-color": edgeColor })
        }
      }
    })

    // Resize and fit nicely
    cy.resize()
    cy.fit(undefined, 40)
  }

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
      matched.connectedEdges().style({ opacity: 0.7 })

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
    matched.connectedEdges().style({ opacity: 0.6 })
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

  onMount(() => {
    void loadGraph()

    // Watch for size changes so Cytoscape never renders blank or misaligned
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
    <div class="relative w-full h-full flex flex-col bg-v2-background-bg-base overflow-hidden select-none">
      {/* Top Floating Glassmorphic Toolbar */}
      <div class="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-v2-border-subtle bg-v2-background-bg-surface-elevated/90 px-3 py-2 shadow-lg backdrop-blur-md">
        <div class="flex items-center gap-2">
          {/* Search box */}
          <div class="relative flex items-center">
            <Icon name="magnifying-glass" size="small" class="absolute left-2.5 text-v2-text-text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Filter modules..."
              value={searchQuery()}
              onInput={(e) => handleSearch(e.currentTarget.value)}
              class="h-7 w-40 sm:w-56 rounded-md border border-v2-border-subtle bg-v2-background-bg-base ps-8 pe-2.5 text-xs text-v2-text-text-base placeholder:text-v2-text-text-muted focus:outline-none focus:border-v2-accent"
            />
          </div>

          {/* Quick filter chips */}
          <div class="hidden sm:flex items-center gap-1 text-[11px]">
            <button
              type="button"
              class="px-2 py-0.5 rounded-md transition-colors"
              classList={{
                "bg-v2-accent/15 text-v2-accent font-medium": activeFilter() === "all",
                "text-v2-text-text-muted hover:text-v2-text-text-base": activeFilter() !== "all",
              }}
              onClick={() => filterByKind("all")}
            >
              All
            </button>
            <button
              type="button"
              class="px-2 py-0.5 rounded-md transition-colors flex items-center gap-1"
              classList={{
                "bg-[#38bdf8]/15 text-[#38bdf8] font-medium": activeFilter() === "component",
                "text-v2-text-text-muted hover:text-v2-text-text-base": activeFilter() !== "component",
              }}
              onClick={() => filterByKind("component")}
            >
              <span class="w-1.5 h-1.5 rounded-full bg-[#38bdf8]" />
              UI
            </button>
            <button
              type="button"
              class="px-2 py-0.5 rounded-md transition-colors flex items-center gap-1"
              classList={{
                "bg-[#e5a93c]/15 text-[#e5a93c] font-medium": activeFilter() === "module",
                "text-v2-text-text-muted hover:text-v2-text-text-base": activeFilter() !== "module",
              }}
              onClick={() => filterByKind("module")}
            >
              <span class="w-1.5 h-1.5 rounded-full bg-[#e5a93c]" />
              Logic
            </button>
          </div>
        </div>

        {/* Right Stats & Controls */}
        <div class="flex items-center gap-2">
          <span class="text-[11px] text-v2-text-text-muted font-mono">
            {graphData().fileCount} files · {graphData().dependencyCount} links
          </span>

          <div class="flex items-center border-s border-v2-border-subtle ps-2 gap-1">
            <IconButton
              icon={<Icon name="plus" size="small" />}
              size="small"
              variant="ghost-muted"
              aria-label="Zoom in"
              onClick={zoomIn}
            />
            <IconButton
              icon={<Icon name="dash" size="small" />}
              size="small"
              variant="ghost-muted"
              aria-label="Zoom out"
              onClick={zoomOut}
            />
            <IconButton
              icon={<Icon name="expand" size="small" />}
              size="small"
              variant="ghost-muted"
              aria-label="Fit view"
              onClick={fitView}
            />
            <IconButton
              icon={<Icon name="arrow-clockwise" size="small" />}
              size="small"
              variant="ghost-muted"
              aria-label="Rescan"
              onClick={() => void loadGraph()}
            />
          </div>
        </div>
      </div>

      {/* Graph Canvas Container */}
      <div
        class="relative flex-1 w-full h-full"
        style={{
          "background-image": "radial-gradient(circle, var(--v2-border-subtle) 1px, transparent 1px)",
          "background-size": "24px 24px",
        }}
      >
        <Show when={loading()}>
          <div class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-v2-background-bg-base/75 backdrop-blur-xs gap-3">
            <div class="w-6 h-6 border-2 border-v2-accent border-t-transparent rounded-full animate-spin" />
            <span class="text-xs text-v2-text-text-muted font-mono">Mapping codebase architecture...</span>
          </div>
        </Show>

        <Show when={!loading() && graphData().fileCount === 0}>
          <div class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 p-4">
            <Icon name="graph" size="large" class="text-v2-text-text-muted opacity-40" />
            <span class="text-xs text-v2-text-text-muted">No code files detected in this workspace directory.</span>
            <Button variant="outline" size="small" onClick={() => void loadGraph()}>
              Scan Again
            </Button>
          </div>
        </Show>

        <div ref={containerRef} class="w-full h-full" />

        {/* Selected Node Detail Drawer */}
        <Show when={selectedNode()}>
          {(node) => (
            <div class="absolute bottom-4 right-4 z-20 w-80 rounded-xl border border-v2-border-subtle bg-v2-background-bg-surface-elevated/95 p-4 shadow-2xl backdrop-blur-md">
              <div class="flex items-start justify-between gap-2 mb-2">
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span
                      class="w-2 h-2 rounded-full"
                      style={{ "background-color": KIND_COLORS[node().kind ?? "module"] ?? "#e5a93c" }}
                    />
                    <h4 class="text-xs font-semibold text-v2-text-text-base truncate font-mono">{node().label}</h4>
                  </div>
                  <p class="text-[11px] text-v2-text-text-muted truncate mt-0.5 font-mono">{node().path}</p>
                </div>
                <IconButton
                  icon={<Icon name="close" size="small" />}
                  size="small"
                  variant="ghost-muted"
                  aria-label="Close"
                  onClick={() => setSelectedNode(null)}
                />
              </div>

              <div class="flex items-center gap-2 my-3 text-[11px] text-v2-text-text-muted">
                <span class="px-2 py-0.5 rounded-md bg-v2-background-bg-base border border-v2-border-subtle font-mono">
                  {node().ext ? `.${node().ext}` : "file"}
                </span>
                <span class="px-2 py-0.5 rounded-md bg-v2-background-bg-base border border-v2-border-subtle font-mono">
                  {node().kind ?? "module"}
                </span>
                <Show when={node().degree !== undefined && node().degree! > 0}>
                  <span class="px-2 py-0.5 rounded-md bg-v2-background-bg-base border border-v2-border-subtle font-mono">
                    {node().degree} connections
                  </span>
                </Show>
              </div>

              <Show when={props.onSelectModule}>
                <Button
                  variant="contrast"
                  size="small"
                  class="w-full justify-center gap-1.5 mt-2"
                  onClick={() => {
                    props.onSelectModule?.(node().path ?? node().id)
                  }}
                >
                  <Icon name="bubble-5" size="small" />
                  <span>Chat about this module</span>
                </Button>
              </Show>
            </div>
          )}
        </Show>
      </div>
    </div>
  )
}
