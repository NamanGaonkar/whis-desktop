import {
  Component,
  createSignal,
  onCleanup,
  onMount,
  Show,
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

  const [cbmAvailable, setCbmAvailable] = createSignal(false)
  const [activeTab, setActiveTab] = createSignal<"cbm" | "native">("native")
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

  async function checkCbmLens() {
    try {
      // Use no-cors probe to detect if CBM Lens is running on port 9749
      await fetch("http://localhost:9749/", { method: "HEAD", mode: "no-cors" })
      setCbmAvailable(true)
      setActiveTab("cbm")
    } catch {
      setCbmAvailable(false)
      setActiveTab("native")
    }
  }

  async function loadGraph() {
    setLoading(true)
    try {
      const data = await scanCodebaseGraph(client.api, props.directory)
      setGraphData(data)
      setLoading(false)
      setTimeout(() => {
        if (activeTab() === "native") {
          initCytoscape(data)
        }
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

    const nodeBg = isDark ? "#181410" : "#fdfbf7"
    const nodeText = isDark ? "#ede6dd" : "#2a241c"
    const edgeColor = isDark ? "#3f362a" : "#d4c8b8"
    const accentColor = "#e5a93c" // Whis gold

    const formattedNodes = data.nodes.map((node) => {
      const kind = node.data.kind ?? "module"
      const color = KIND_COLORS[kind] ?? accentColor
      const size = Math.max(26, Math.min(46, 26 + (node.data.degree ?? 0) * 3))

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
      wheelSensitivity: 0.25,
      minZoom: 0.15,
      maxZoom: 3.5,
      layout: {
        name: "cose",
        animate: true,
        animationDuration: 600,
        nodeRepulsion: () => 14000,
        nodeOverlap: 20,
        idealEdgeLength: () => 85,
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
            "font-family": "monospace",
            "font-size": 11,
            "text-valign": "bottom",
            "text-margin-y": 6,
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
            width: 1.2,
            "line-color": edgeColor,
            "target-arrow-color": edgeColor,
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            opacity: 0.65,
            "arrow-scale": 0.8,
            "transition-property": "line-color, target-arrow-color, width, opacity",
            "transition-duration": 200,
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
    void checkCbmLens()
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
    <div class="relative w-full h-full flex flex-col bg-[#080502] text-[#ede6dd] overflow-hidden select-none">
      {/* Top Floating Whis Glassmorphic Bar */}
      <div class="absolute top-2.5 left-3 right-3 z-30 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#140f0a]/90 px-3 py-1.5 shadow-md backdrop-blur-md border border-[#261f17]">
        <div class="flex items-center gap-2">
          {/* Mode Switcher */}
          <div class="flex items-center bg-[#1c1610] rounded-md p-0.5 border border-[#30261c] text-xs">
            <Show when={cbmAvailable()}>
              <button
                type="button"
                class="px-2.5 py-1 rounded transition-colors flex items-center gap-1.5"
                classList={{
                  "bg-[#e5a93c] text-[#080502] font-semibold": activeTab() === "cbm",
                  "text-[#a59a8c] hover:text-[#ede6dd]": activeTab() !== "cbm",
                }}
                onClick={() => setActiveTab("cbm")}
              >
                <span>🌌 CBM 3D Lens</span>
              </button>
            </Show>
            <button
              type="button"
              class="px-2.5 py-1 rounded transition-colors flex items-center gap-1.5"
              classList={{
                "bg-[#e5a93c] text-[#080502] font-semibold": activeTab() === "native",
                "text-[#a59a8c] hover:text-[#ede6dd]": activeTab() !== "native",
              }}
              onClick={() => {
                setActiveTab("native")
                setTimeout(() => {
                  if (graphData().nodes.length > 0) initCytoscape(graphData())
                }, 50)
              }}
            >
              <Icon name="graph" size="small" />
              <span>Whis Topology</span>
            </button>
          </div>

          <Show when={activeTab() === "native"}>
            {/* Search box */}
            <div class="relative flex items-center">
              <Icon name="magnifying-glass" size="small" class="absolute left-2 text-[#7d7162] pointer-events-none" />
              <input
                type="text"
                placeholder="Search modules..."
                value={searchQuery()}
                onInput={(e) => handleSearch(e.currentTarget.value)}
                class="h-7 w-36 sm:w-48 rounded-md bg-[#18130e] ps-7 pe-2 text-xs text-[#ede6dd] placeholder:text-[#7d7162] border border-[#2c2217] focus:outline-none focus:border-[#e5a93c]"
              />
            </div>

            {/* Quick filter chips */}
            <div class="hidden md:flex items-center gap-1 text-[11px]">
              <button
                type="button"
                class="px-2 py-0.5 rounded transition-colors"
                classList={{
                  "bg-[#e5a93c]/20 text-[#e5a93c] font-medium": activeFilter() === "all",
                  "text-[#7d7162] hover:text-[#ede6dd]": activeFilter() !== "all",
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
                  "text-[#7d7162] hover:text-[#ede6dd]": activeFilter() !== "component",
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
                  "text-[#7d7162] hover:text-[#ede6dd]": activeFilter() !== "module",
                }}
                onClick={() => filterByKind("module")}
              >
                <span class="w-1.5 h-1.5 rounded-full bg-[#e5a93c]" />
                Logic
              </button>
            </div>
          </Show>
        </div>

        {/* Right Controls */}
        <div class="flex items-center gap-2">
          <Show when={activeTab() === "native"}>
            <span class="text-[11px] text-[#7d7162] font-mono">
              {graphData().fileCount} files · {graphData().dependencyCount} links
            </span>
            <div class="flex items-center border-s border-[#2c2217] ps-1.5 gap-0.5">
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
          </Show>

          <Show when={props.onClose}>
            <IconButton
              icon={<Icon name="close" size="small" />}
              size="small"
              variant="ghost-muted"
              aria-label="Close knowledge graph"
              onClick={props.onClose}
            />
          </Show>
        </div>
      </div>

      {/* Main View Area */}
      <Show when={activeTab() === "cbm" && cbmAvailable()}>
        <div class="relative w-full h-full pt-12 bg-[#080502]">
          <iframe
            src="http://localhost:9749"
            class="w-full h-full border-none bg-[#080502]"
            title="Codebase Memory 3D Graph Lens"
          />
        </div>
      </Show>

      <Show when={activeTab() === "native" || !cbmAvailable()}>
        <div
          class="relative flex-1 w-full h-full pt-12"
          style={{
            "background-image": "radial-gradient(circle, #211a14 1px, transparent 1px)",
            "background-size": "24px 24px",
          }}
        >
          <Show when={loading()}>
            <div class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#080502]/85 backdrop-blur-xs gap-3">
              <div class="w-6 h-6 border-2 border-[#e5a93c] border-t-transparent rounded-full animate-spin" />
              <span class="text-xs text-[#a59a8c] font-mono">Mapping codebase architecture...</span>
            </div>
          </Show>

          <Show when={!loading() && graphData().fileCount === 0}>
            <div class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 p-4">
              <Icon name="graph" size="large" class="text-[#7d7162] opacity-40" />
              <span class="text-xs text-[#7d7162]">No code files detected in this workspace directory.</span>
              <Button variant="outline" size="small" onClick={() => void loadGraph()}>
                Scan Again
              </Button>
            </div>
          </Show>

          <div ref={containerRef} class="w-full h-full" />

          {/* Selected Node Detail Drawer */}
          <Show when={selectedNode()}>
            {(node) => (
              <div class="absolute bottom-4 right-4 z-20 w-80 rounded-xl bg-[#140f0a]/95 border border-[#2c2217] p-4 shadow-2xl backdrop-blur-md">
                <div class="flex items-start justify-between gap-2 mb-2">
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5">
                      <span
                        class="w-2 h-2 rounded-full"
                        style={{ "background-color": KIND_COLORS[node().kind ?? "module"] ?? "#e5a93c" }}
                      />
                      <h4 class="text-xs font-semibold text-[#ede6dd] truncate font-mono">{node().label}</h4>
                    </div>
                    <p class="text-[11px] text-[#7d7162] truncate mt-0.5 font-mono">{node().path}</p>
                  </div>
                  <IconButton
                    icon={<Icon name="close" size="small" />}
                    size="small"
                    variant="ghost-muted"
                    aria-label="Close"
                    onClick={() => setSelectedNode(null)}
                  />
                </div>

                <div class="flex items-center gap-2 my-3 text-[11px] text-[#a59a8c]">
                  <span class="px-2 py-0.5 rounded-md bg-[#1c1610] border border-[#2c2217] font-mono">
                    {node().ext ? `.${node().ext}` : "file"}
                  </span>
                  <span class="px-2 py-0.5 rounded-md bg-[#1c1610] border border-[#2c2217] font-mono">
                    {node().kind ?? "module"}
                  </span>
                  <Show when={node().degree !== undefined && node().degree! > 0}>
                    <span class="px-2 py-0.5 rounded-md bg-[#1c1610] border border-[#2c2217] font-mono">
                      {node().degree} links
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
      </Show>
    </div>
  )
}
