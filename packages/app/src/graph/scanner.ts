import type { OpenCodeClient } from "@opencode/client/promise"

export interface GraphNode {
  data: {
    id: string
    label: string
    type: "file" | "symbol" | "package"
    ext?: string
    kind?: "component" | "module" | "server" | "config" | "type"
    package?: string
    path?: string
    size?: number
    degree?: number
  }
}

export interface GraphEdge {
  data: {
    id: string
    source: string
    target: string
    label?: string
    type: "import" | "dependency"
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
  "tmp",
  "cache",
]

function getFileKind(ext: string, filePath: string): GraphNode["data"]["kind"] {
  const lower = filePath.toLowerCase()
  if (lower.includes("server") || lower.includes("api") || lower.includes("backend")) return "server"
  if (ext === "tsx" || ext === "jsx") return "component"
  if (lower.includes("types") || lower.includes(".d.ts")) return "type"
  if (ext === "json" || ext === "yaml" || ext === "yml" || ext === "toml") return "config"
  return "module"
}

export async function scanCodebaseGraph(
  client: OpenCodeClient,
  directory?: string,
): Promise<GraphData> {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const nodeMap = new Map<string, GraphNode>()
  const edgeSet = new Set<string>()
  const degreeMap = new Map<string, number>()

  const loc = directory ? { directory } : undefined

  // Collect candidate project files
  const filePaths: string[] = []

  // Strategy 1: Try client.file.find with "." wildcard
  try {
    const res = await client.file.find({
      location: loc,
      query: ".",
      type: "file",
      limit: 300,
    })

    if (res?.data && res.data.length > 0) {
      for (const entry of res.data) {
        filePaths.push(entry.path)
      }
    }
  } catch (err) {
    console.warn("Graph file.find fallback:", err)
  }

  // Strategy 2: If strategy 1 returned few/no files, use recursive directory listing
  if (filePaths.length < 5) {
    const queue: string[] = [""]
    let visitedDirs = 0

    while (queue.length > 0 && filePaths.length < 250 && visitedDirs < 30) {
      const currentDir = queue.shift()!
      visitedDirs++

      try {
        const res = await client.file.list({
          location: loc,
          path: currentDir || undefined,
        })

        for (const entry of res.data ?? []) {
          const p = entry.path.toLowerCase()
          if (IGNORED_PATHS.some((ignored) => p.includes(ignored))) continue

          if (entry.type === "directory") {
            if (visitedDirs < 30 && queue.length < 20) {
              queue.push(entry.path)
            }
          } else {
            filePaths.push(entry.path)
          }
        }
      } catch {
        // Continue queue
      }
    }
  }

  // Filter to meaningful code files
  const validFiles = Array.from(new Set(filePaths)).filter((filePath) => {
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
  for (const filePath of validFiles) {
    const parts = filePath.split(/[/\\]/)
    const filename = parts.at(-1) ?? filePath
    const pkg = parts.length > 2 ? parts[1] : parts[0]
    const ext = filename.split(".").at(-1) ?? ""
    const kind = getFileKind(ext, filePath)

    const node: GraphNode = {
      data: {
        id: filePath,
        label: filename,
        type: "file",
        ext,
        kind,
        package: pkg,
        path: filePath,
        degree: 0,
      },
    }
    nodeMap.set(filePath, node)
    nodes.push(node)
  }

  // Inspect first 80 files to extract import dependencies
  const inspectionLimit = Math.min(validFiles.length, 80)
  for (let i = 0; i < inspectionLimit; i++) {
    const filePath = validFiles[i]
    try {
      const fileBytes = await client.file.read({
        location: loc,
        path: filePath,
      })

      const content = fileBytes ? new TextDecoder().decode(fileBytes) : ""
      if (!content) continue

      // Match import specs (ESM & CJS)
      const importRegex = /(?:import\s+(?:[\w*\s{},]*\s+from\s+)?['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g
      let match: RegExpExecArray | null

      while ((match = importRegex.exec(content)) !== null) {
        const importSpec = match[1] || match[2]
        if (!importSpec) continue
        if (importSpec.startsWith("@") && !importSpec.includes("/")) continue

        const matchedTarget = validFiles.find((f) => {
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

            // Track degrees for centrality sizing
            degreeMap.set(filePath, (degreeMap.get(filePath) ?? 0) + 1)
            degreeMap.set(matchedTarget, (degreeMap.get(matchedTarget) ?? 0) + 1)
          }
        }
      }
    } catch {
      // Skip files that cannot be read
    }
  }

  // Update node degrees for dynamic node sizing
  for (const node of nodes) {
    node.data.degree = degreeMap.get(node.data.id) ?? 0
  }

  return {
    nodes,
    edges,
    fileCount: nodes.length,
    dependencyCount: edges.length,
  }
}
