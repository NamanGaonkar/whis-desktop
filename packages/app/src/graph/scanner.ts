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

  // File cache for cross-referencing
  interface FileCacheItem {
    filePath: string
    content: string
    symbols: string[]
    imports: string[]
  }
  const fileCache: FileCacheItem[] = []

  // Helper to add edge safely
  function addEdge(source: string, target: string, type: "import" | "dependency" = "import") {
    if (source === target) return
    const edgeId = `${source}->${target}`
    if (edgeSet.has(edgeId)) return
    edgeSet.add(edgeId)

    edges.push({
      data: {
        id: edgeId,
        source,
        target,
        type,
      },
    })

    // Track degrees
    degreeMap.set(source, (degreeMap.get(source) ?? 0) + 1)
    degreeMap.set(target, (degreeMap.get(target) ?? 0) + 1)

    // Track dependencies & dependents
    const deps = dependenciesMap.get(source) ?? []
    deps.push(target)
    dependenciesMap.set(source, deps)

    const dependents = dependentsMap.get(target) ?? []
    dependents.push(source)
    dependentsMap.set(target, dependents)
  }

  // Pass 1: Read files and extract defined symbols & explicit imports across languages
  const inspectionLimit = Math.min(validFiles.length, 120)
  for (let i = 0; i < inspectionLimit; i++) {
    const filePath = validFiles[i]
    try {
      const cleanPath = filePath.replace(/^[/\\]+/, "").replaceAll("\\", "/")
      let fileBytes: Uint8Array | undefined
      try {
        fileBytes = await client.file.read({
          location: loc,
          path: cleanPath,
        })
      } catch {
        fileBytes = await client.file.read({
          path: cleanPath,
        })
      }

      const content = fileBytes ? new TextDecoder().decode(fileBytes) : ""
      if (!content) continue

      const symbols: string[] = []
      const imports: string[] = []
      const lower = filePath.toLowerCase()

      // 1. Language-Specific Symbol Extraction
      if (lower.endsWith(".go")) {
        // Go functions & methods: func Name( or func (r Receiver) Name(
        const funcRegex = /func\s+(?:\([^)]+\)\s+)?([A-Za-z0-9_]{3,})\s*\(/g
        let m: RegExpExecArray | null
        while ((m = funcRegex.exec(content)) !== null) {
          if (m[1] && !symbols.includes(m[1])) symbols.push(m[1])
        }
        // Go types: type Name struct / interface
        const typeRegex = /type\s+([A-Za-z0-9_]{3,})\s+(?:struct|interface)/g
        while ((m = typeRegex.exec(content)) !== null) {
          if (m[1] && !symbols.includes(m[1])) symbols.push(m[1])
        }
        // Go imports: import "..." or import ( ... )
        const goImportBlock = /import\s*\(([\s\S]*?)\)/g
        while ((m = goImportBlock.exec(content)) !== null) {
          const lines = m[1].split("\n")
          for (const line of lines) {
            const spec = line.match(/"([^"]+)"/)
            if (spec && spec[1]) imports.push(spec[1])
          }
        }
        const singleGoImport = /import\s+"([^"]+)"/g
        while ((m = singleGoImport.exec(content)) !== null) {
          if (m[1]) imports.push(m[1])
        }
      } else if (lower.endsWith(".py")) {
        // Python classes & functions
        const pyRegex = /(?:def|class)\s+([A-Za-z0-9_]{3,})/g
        let m: RegExpExecArray | null
        while ((m = pyRegex.exec(content)) !== null) {
          if (m[1] && !symbols.includes(m[1])) symbols.push(m[1])
        }
        // Python imports: import x or from x import y
        const pyImportRegex = /(?:from\s+([a-zA-Z0-9_.]+)\s+import|import\s+([a-zA-Z0-9_.]+))/g
        while ((m = pyImportRegex.exec(content)) !== null) {
          const spec = m[1] || m[2]
          if (spec) imports.push(spec)
        }
      } else if (lower.endsWith(".rs")) {
        // Rust structs, enums, functions
        const rsRegex = /(?:pub\s+)?(?:fn|struct|enum|trait)\s+([A-Za-z0-9_]{3,})/g
        let m: RegExpExecArray | null
        while ((m = rsRegex.exec(content)) !== null) {
          if (m[1] && !symbols.includes(m[1])) symbols.push(m[1])
        }
        // Rust use or mod
        const rsImportRegex = /(?:use\s+([a-zA-Z0-9_:]+)|mod\s+([a-zA-Z0-9_]+))/g
        while ((m = rsImportRegex.exec(content)) !== null) {
          const spec = m[1] || m[2]
          if (spec) imports.push(spec)
        }
      } else {
        // TypeScript / JavaScript
        const tsSymbolRegex = /(?:export\s+(?:default\s+)?(?:class|function|interface|type|const|let|var)\s+([A-Za-z0-9_$]+))/g
        let m: RegExpExecArray | null
        while ((m = tsSymbolRegex.exec(content)) !== null) {
          if (m[1] && !symbols.includes(m[1])) symbols.push(m[1])
        }
        // JS/TS imports
        const jsImportRegex = /(?:import\s+(?:[\w*\s{},]*\s+from\s+)?['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g
        while ((m = jsImportRegex.exec(content)) !== null) {
          const spec = m[1] || m[2]
          if (spec) imports.push(spec)
        }
      }

      const currentNode = nodeMap.get(filePath)
      if (currentNode) {
        currentNode.data.symbols = symbols.slice(0, 10)
      }

      fileCache.push({
        filePath,
        content,
        symbols,
        imports,
      })
    } catch {
      // Continue to next file
    }
  }

  // Pass 2: Connect via explicit imports
  for (const item of fileCache) {
    for (const importSpec of item.imports) {
      if (importSpec.startsWith("@") && !importSpec.includes("/")) continue

      const specBase = importSpec.split(/[/\\]/).at(-1)?.replace(/\.[a-zA-Z0-9]+$/, "")
      if (!specBase) continue

      const matchedTarget = validFiles.find((f) => {
        if (f === item.filePath) return false
        const targetBase = f.split(/[/\\]/).at(-1)?.replace(/\.[a-zA-Z0-9]+$/, "")
        return targetBase === specBase
      })

      if (matchedTarget) {
        addEdge(item.filePath, matchedTarget, "import")
      }
    }
  }

  // Pass 3: Cross-Reference Symbol Linking
  const symbolToFile = new Map<string, string[]>()
  for (const item of fileCache) {
    for (const sym of item.symbols) {
      if (sym.length < 4) continue
      if (["init", "main", "test", "data", "type", "error"].includes(sym.toLowerCase())) continue
      const list = symbolToFile.get(sym) ?? []
      list.push(item.filePath)
      symbolToFile.set(sym, list)
    }
  }

  for (const item of fileCache) {
    for (const [sym, declaringFiles] of symbolToFile.entries()) {
      for (const targetFile of declaringFiles) {
        if (targetFile === item.filePath) continue
        const regex = new RegExp(`\\b${sym}\\b`)
        if (regex.test(item.content)) {
          addEdge(item.filePath, targetFile, "dependency")
        }
      }
    }
  }

  // Pass 4: Universal Test-to-Implementation Matching (Runs across ALL validFiles)
  for (const file of validFiles) {
    const isTest = /(?:_test|\.test|\.spec)\.[a-zA-Z0-9]+$/i.test(file)
    if (!isTest) continue

    const baseName = file
      .split(/[/\\]/)
      .at(-1)!
      .replace(/(?:_test|\.test|\.spec)\.[a-zA-Z0-9]+$/i, "")
      .toLowerCase()

    // Find direct counterpart (e.g. classifier_test.go -> classifier.go)
    const exactMatch = validFiles.find((f) => {
      if (f === file) return false
      const fBase = f.split(/[/\\]/).at(-1)!.replace(/\.[a-zA-Z0-9]+$/i, "").toLowerCase()
      return fBase === baseName
    })

    if (exactMatch) {
      addEdge(file, exactMatch, "dependency")
    } else {
      // Find counterpart sharing the stem prefix (e.g. table_test.go -> table.go)
      const prefixMatch = validFiles.find((f) => {
        if (f === file) return false
        const fBase = f.split(/[/\\]/).at(-1)!.replace(/\.[a-zA-Z0-9]+$/i, "").toLowerCase()
        return fBase.startsWith(baseName) || baseName.startsWith(fBase)
      })
      if (prefixMatch) {
        addEdge(file, prefixMatch, "dependency")
      }
    }
  }

  // Pass 5: Domain Stem Clustering (e.g., torrent_client.go <-> torrent.go, http_dl.go <-> http.go)
  for (const file of validFiles) {
    const filename = file.split(/[/\\]/).at(-1)!.toLowerCase()
    const stem = filename.split(/[._-]/)[0]
    if (!stem || stem.length < 3) continue

    // Find sibling files in validFiles that share this domain stem
    const domainSiblings = validFiles.filter((f) => {
      if (f === file) return false
      const otherName = f.split(/[/\\]/).at(-1)!.toLowerCase()
      const otherStem = otherName.split(/[._-]/)[0]
      return otherStem === stem
    })

    if (domainSiblings.length > 0) {
      // Find leader file (e.g., torrent.go over torrent_client.go, http.go over http_dl.go)
      const leader = domainSiblings.find((f) => {
        const base = f.split(/[/\\]/).at(-1)!.replace(/\.[a-zA-Z0-9]+$/i, "").toLowerCase()
        return base === stem
      }) ?? domainSiblings[0]

      if (leader !== file) {
        addEdge(file, leader, "dependency")
      }
    }
  }

  // Pass 6: Architectural Entrypoint & Hub Topology
  // Identify root entrypoints and major hubs
  const entrypoints = validFiles.filter((f) => {
    const lower = f.toLowerCase()
    return (
      lower.endsWith("main.go") ||
      lower.endsWith("app.go") ||
      lower.endsWith("index.ts") ||
      lower.endsWith("index.js") ||
      lower.endsWith("main.py") ||
      lower.endsWith("app.py") ||
      lower.endsWith("main.rs") ||
      lower.endsWith("lib.rs") ||
      lower.endsWith("server.ts")
    )
  })

  const primaryHub = entrypoints.length > 0 ? entrypoints[0] : validFiles[0]

  // Connect secondary entrypoints to primary hub
  for (const ep of entrypoints) {
    if (ep !== primaryHub) {
      addEdge(ep, primaryHub, "dependency")
    }
  }

  // Pass 7: Ensure Zero Orphan Nodes
  // Any file with degree 0 gets linked to the most appropriate hub or main module
  for (const file of validFiles) {
    const curDegree = degreeMap.get(file) ?? 0
    if (curDegree === 0 && file !== primaryHub) {
      // Connect to primary hub or nearest domain leader
      addEdge(file, primaryHub, "dependency")
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
