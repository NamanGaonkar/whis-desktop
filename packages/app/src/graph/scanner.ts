import type { OpenCodeClient } from "@opencode/client/promise"

export interface GraphNode {
  data: {
    id: string
    label: string
    type: "file" | "symbol" | "package"
    ext?: string
    kind?: "component" | "module" | "server" | "config" | "type"
    package?: string
    path: string
    size?: number
    degree?: number
    symbols?: string[]
    dependencies?: string[]
    dependents?: string[]
    color?: string
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
  if (lower.includes("server") || lower.includes("api") || lower.includes("backend") || lower.includes("route")) return "server"
  if (ext === "tsx" || ext === "jsx" || lower.includes("component") || lower.includes("view")) return "component"
  if (lower.includes("types") || lower.includes(".d.ts") || lower.includes("schema")) return "type"
  if (ext === "json" || ext === "yaml" || ext === "yml" || ext === "toml" || lower.includes("config")) return "config"
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
  const dependenciesMap = new Map<string, string[]>()
  const dependentsMap = new Map<string, string[]>()

  const loc = directory ? { directory } : undefined

  // Collect candidate project files
  const filePaths: string[] = []

  // Strategy 1: Try client.file.find with empty and root queries
  for (const q of ["", "."]) {
    if (filePaths.length > 50) break
    try {
      const res = await client.file.find({
        location: loc,
        query: q,
        type: "file",
        limit: 500,
      })

      if (res?.data && res.data.length > 0) {
        for (const entry of res.data) {
          if (entry.path) filePaths.push(entry.path)
        }
      }
    } catch {
      // Continue to next strategy
    }
  }

  // Strategy 2: Recursive directory listing if find returned few files
  if (filePaths.length < 15) {
    const queue: string[] = [""]
    let visitedDirs = 0

    while (queue.length > 0 && filePaths.length < 400 && visitedDirs < 60) {
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
            if (visitedDirs < 60 && queue.length < 40) {
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
        symbols: [],
        dependencies: [],
        dependents: [],
      },
    }
    nodeMap.set(filePath, node)
    nodes.push(node)
  }

  // Inspect first 100 files to extract import dependencies & exported symbols
  const inspectionLimit = Math.min(validFiles.length, 100)
  for (let i = 0; i < inspectionLimit; i++) {
    const filePath = validFiles[i]
    try {
      const fileBytes = await client.file.read({
        location: loc,
        path: filePath,
      })

      const content = fileBytes ? new TextDecoder().decode(fileBytes) : ""
      if (!content) continue

      // Extract exported symbols (classes, functions, interfaces, constants)
      const symbols: string[] = []
      const symbolRegex = /(?:export\s+(?:default\s+)?(?:class|function|interface|type|const|let|var)\s+([A-Za-z0-9_$]+))/g
      let symMatch: RegExpExecArray | null
      while ((symMatch = symbolRegex.exec(content)) !== null) {
        if (symMatch[1] && !symbols.includes(symMatch[1])) {
          symbols.push(symMatch[1])
        }
      }

      const currentNode = nodeMap.get(filePath)
      if (currentNode) {
        currentNode.data.symbols = symbols.slice(0, 8)
      }

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

            // Track degrees
            degreeMap.set(filePath, (degreeMap.get(filePath) ?? 0) + 1)
            degreeMap.set(matchedTarget, (degreeMap.get(matchedTarget) ?? 0) + 1)

            // Track dependencies & dependents
            const deps = dependenciesMap.get(filePath) ?? []
            deps.push(matchedTarget)
            dependenciesMap.set(filePath, deps)

            const dependents = dependentsMap.get(matchedTarget) ?? []
            dependents.push(filePath)
            dependentsMap.set(matchedTarget, dependents)
          }
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  // Populate node metadata
  for (const node of nodes) {
    node.data.degree = degreeMap.get(node.data.id) ?? 0
    node.data.dependencies = dependenciesMap.get(node.data.id) ?? []
    node.data.dependents = dependentsMap.get(node.data.id) ?? []
  }

  return {
    nodes,
    edges,
    fileCount: nodes.length,
    dependencyCount: edges.length,
  }
}
