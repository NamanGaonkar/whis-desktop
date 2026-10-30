import type { OpenCodeClient } from "@opencode/client/promise"

export interface GraphNode {
  data: {
    id: string
    label: string
    type: "file" | "symbol" | "package"
    ext?: string
    kind?: string
    package?: string
    path?: string
  }
}

export interface GraphEdge {
  data: {
    id: string
    source: string
    target: string
    label?: string
    type: "import" | "call"
  }
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  fileCount: number
  dependencyCount: number
}

const IGNORED_PATHS = [
  "node_modules",
  ".git",
  "dist",
  "out",
  ".turbo",
  ".next",
  "build",
  "coverage",
]

export async function scanCodebaseGraph(
  client: OpenCodeClient,
  directory?: string,
): Promise<GraphData> {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const nodeMap = new Map<string, GraphNode>()
  const edgeSet = new Set<string>()

  try {
    // Query files using the built-in file search client
    const res = await client.file.find({
      location: directory ? { directory } : undefined,
      query: "",
      type: "file",
      limit: 150,
    })

    const rawEntries = res.data ?? []
    const files = rawEntries
      .map((entry) => entry.path)
      .filter((filePath) => {
        const p = filePath.toLowerCase()
        if (IGNORED_PATHS.some((ignored) => p.includes(ignored))) return false
        return (
          p.endsWith(".ts") ||
          p.endsWith(".tsx") ||
          p.endsWith(".js") ||
          p.endsWith(".jsx") ||
          p.endsWith(".py") ||
          p.endsWith(".go") ||
          p.endsWith(".rs") ||
          p.endsWith(".json")
        )
      })

    // Create file nodes
    for (const filePath of files) {
      const parts = filePath.split(/[/\\]/)
      const filename = parts.at(-1) ?? filePath
      const pkg = parts.length > 2 ? parts[1] : parts[0]
      const ext = filename.split(".").at(-1) ?? ""

      const node: GraphNode = {
        data: {
          id: filePath,
          label: filename,
          type: "file",
          ext,
          package: pkg,
          path: filePath,
        },
      }
      nodeMap.set(filePath, node)
      nodes.push(node)
    }

    // Inspect first 60 files to extract import dependencies
    const inspectionLimit = Math.min(files.length, 60)
    for (let i = 0; i < inspectionLimit; i++) {
      const filePath = files[i]
      try {
        const fileBytes = await client.file.read({
          location: directory ? { directory } : undefined,
          path: filePath,
        })

        const content = fileBytes ? new TextDecoder().decode(fileBytes) : ""
        if (!content) continue

        // Extract imports (ESM & CJS)
        const importRegex = /(?:import\s+(?:[\w*\s{},]*\s+from\s+)?['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g
        let match: RegExpExecArray | null

        while ((match = importRegex.exec(content)) !== null) {
          const importSpec = match[1] || match[2]
          if (!importSpec || importSpec.startsWith("@") && !importSpec.includes("/")) continue

          // Resolve relative or package targets
          const matchedTarget = files.find((f) => {
            if (importSpec.startsWith(".")) {
              const specBase = importSpec.split(/[/\\]/).at(-1)
              return f !== filePath && Boolean(specBase && f.includes(specBase))
            }
            return f !== filePath && f.includes(importSpec)
          })

          if (matchedTarget) {
            const edgeId = `${filePath}->${matchedTarget}`
            if (!edgeSet.has(edgeId)) {
              edgeSet.add(edgeId)
              edges.push({
                data: {
                  id: edgeId,
                  source: filePath,
                  target: matchedTarget,
                  type: "import",
                },
              })
            }
          }
        }
      } catch {
        // Skip files that cannot be read
      }
    }
  } catch (err) {
    console.warn("Graph scan fallback:", err)
  }

  return {
    nodes,
    edges,
    fileCount: nodes.length,
    dependencyCount: edges.length,
  }
}
