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

export const CodebaseKnowledgeGraph: Component<{
  directory?: string
  onSelectModule?: (filePath: string) => void
  onClose?: () => void
}> = (props) => {
  const client = useServerSDK()
  let containerRef: HTMLDivElement | undefined
  let cy: Core | null = null

  const [loading, setLoading] = createSignal(true)
  const [graphData, setGraphData] = createSignal<GraphData>({
    nodes: [],
    edges: [],
    fileCount: 0,
    dependencyCount: 0,
  })
  const [selectedNode, setSelectedNode] = createSignal<GraphNode["data"] | null>(null)
  const [searchQuery, setSearchQuery] = createSignal("")

  async function loadGraph() {
    setLoading(true)
    const data = await scanCodebaseGraph(client.api, props.directory)
    setGraphData(data)
    setLoading(false)
    initCytoscape(data)
  }

  function initCytoscape(data: GraphData) {
    if (!containerRef) return

    if (cy) {
      cy.destroy()
      cy = null
    }

    // Dynamic styling adapted from active CSS variables
    const isDark = typeof document !== "undefined" && !document.documentElement.classList.contains("light")

    const nodeBg = isDark ? "#24201b" : "#f4efe9"
    const nodeBorder = isDark ? "#4d4233" : "#d8cdbf"
    const nodeText = isDark ? "#f0ebe1" : "#2a241c"
    const edgeColor = isDark ? "#3f3528" : "#cfc2b2"
    const accentColor = isDark ? "#e5a93c" : "#b87c14" // Whis gold accent

    cy = cytoscape({
      container: containerRef,
      elements: [...data.nodes, ...data.edges],
      layout: {
        name: "cose",
        animate: true,
        animationDuration: 800,
        randomize: false,
        nodeRepulsion: () => 8000,
        idealEdgeLength: () => 90,
        edgeElasticity: () => 100,
        nestingFactor: 1.2,
      },
      style: [
        {
          selector: "node",
          style: {
            "background-color": nodeBg,
            "border-color": nodeBorder,
            "border-width": 1.5,
            label: "data(label)",
            color: nodeText,
            "font-size": "11px",
            "font-family": "ui-sans-serif, system-ui, sans-serif",
            "text-valign": "bottom",
            "text-margin-y": 4,
            width: 28,
            height: 28,
          },
        },
        {
          selector: "node:selected",
          style: {
            "background-color": accentColor,
            "border-color": "#ffffff",
            "border-width": 2.5,
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
            "arrow-scale": 0.8,
            opacity: 0.8,
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
    })

    cy.on("tap", (event: EventObject) => {
      if (event.target === cy) {
        setSelectedNode(null)
      }
    })
  }

  function handleSearch(query: string) {
    setSearchQuery(query)
    if (!cy || !query.trim()) return

    const matched = cy.nodes().filter((n) => {
      const label = (n.data("label") || "").toLowerCase()
      const path = (n.data("path") || "").toLowerCase()
      return label.includes(query.toLowerCase()) || path.includes(query.toLowerCase())
    })

    if (matched.length > 0) {
      cy.animate({
        center: { eles: matched.first() },
        zoom: 1.5,
        duration: 400,
      })
      matched.first().select()
      setSelectedNode(matched.first().data())
    }
  }

  function zoomIn() {
    cy?.zoom({ level: (cy.zoom() || 1) * 1.3, position: { x: cy.width() / 2, y: cy.height() / 2 } })
  }

  function zoomOut() {
    cy?.zoom({ level: (cy.zoom() || 1) * 0.7, position: { x: cy.width() / 2, y: cy.height() / 2 } })
  }

  function fitView() {
    cy?.fit(undefined, 30)
  }

  onMount(() => {
    void loadGraph()
  })

  onCleanup(() => {
    if (cy) {
      cy.destroy()
      cy = null
    }
  })

  return (
    <div class="relative w-full h-full flex flex-col bg-v2-background-bg-base overflow-hidden select-none">
      {/* Top Action Bar */}
      <div class="flex items-center justify-between px-3 py-2 border-b border-v2-border-subtle bg-v2-background-bg-surface-elevated z-10">
        <div class="flex items-center gap-2">
          <Icon name="graph" size="small" class="text-v2-accent" />
          <span class="text-xs font-semibold text-v2-text-text-base">Codebase Graph</span>
          <span class="text-[11px] text-v2-text-text-muted">
            ({graphData().fileCount} modules · {graphData().dependencyCount} links)
          </span>
        </div>

        <div class="flex items-center gap-2">
          {/* Search filter */}
          <div class="relative flex items-center">
            <input
              type="text"
              placeholder="Search files or modules..."
              value={searchQuery()}
              onInput={(e) => handleSearch(e.currentTarget.value)}
              class="h-7 w-48 sm:w-64 rounded-md border border-v2-border-subtle bg-v2-background-bg-base px-2.5 text-xs text-v2-text-text-base placeholder:text-v2-text-text-muted focus:outline-none focus:border-v2-accent"
            />
          </div>

          {/* Controls */}
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
          </div>
        </div>
      </div>

      {/* Graph Canvas */}
      <div class="relative flex-1 w-full h-full">
        <Show when={loading()}>
          <div class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-v2-background-bg-base/70 backdrop-blur-xs">
            <span class="text-xs text-v2-text-text-muted animate-pulse">Scanning project modules...</span>
          </div>
        </Show>
        <div ref={containerRef} class="w-full h-full" />

        {/* Selected Node Drawer */}
        <Show when={selectedNode()}>
          {(node) => (
            <div class="absolute bottom-4 right-4 z-20 w-80 rounded-xl border border-v2-border-subtle bg-v2-background-bg-surface-elevated p-4 shadow-xl backdrop-blur-md">
              <div class="flex items-start justify-between gap-2 mb-2">
                <div class="min-w-0">
                  <h4 class="text-xs font-semibold text-v2-text-text-base truncate">{node().label}</h4>
                  <p class="text-[11px] text-v2-text-text-muted truncate">{node().path}</p>
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
                <span class="px-2 py-0.5 rounded-md bg-v2-background-bg-base border border-v2-border-subtle">
                  {node().ext ? `.${node().ext}` : "module"}
                </span>
                <Show when={node().package}>
                  <span class="px-2 py-0.5 rounded-md bg-v2-background-bg-base border border-v2-border-subtle">
                    pkg: {node().package}
                  </span>
                </Show>
              </div>

              <Show when={props.onSelectModule}>
                <Button
                  variant="contrast"
                  size="small"
                  class="w-full justify-center gap-1.5"
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
