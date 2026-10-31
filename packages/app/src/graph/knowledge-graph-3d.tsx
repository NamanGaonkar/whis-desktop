import {
  Component,
  createEffect,
  onCleanup,
  onMount,
} from "solid-js"
import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Color,
  AmbientLight,
  DirectionalLight,
  PointLight,
  SphereGeometry,
  MeshStandardMaterial,
  MeshBasicMaterial,
  Mesh,
  Group,
  Vector3,
  Raycaster,
  Vector2,
  LineBasicMaterial,
  BufferGeometry,
  LineSegments,
  SpriteMaterial,
  Sprite,
  CanvasTexture,
  Points,
  PointsMaterial,
  Float32BufferAttribute,
  SRGBColorSpace,
  AdditiveBlending,
} from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import type { GraphData, GraphNode } from "./scanner"

// Vibrant palette matching the reference image (lime, gold, cyan, purple, coral, amber)
const CLUSTER_COLORS = [
  0x4ade80, // Lime neon green
  0xfacc15, // Golden yellow
  0x38bdf8, // Electric sky blue
  0xc084fc, // Lavender purple
  0xf43f5e, // Coral pink/red
  0xfb923c, // Vibrant orange
  0x2dd4bf, // Teal turquoise
  0xa855f7, // Deep violet
  0x34d399, // Mint emerald
  0xe5a93c, // Whis Gold
]

const KIND_COLORS: Record<string, number> = {
  component: 0x38bdf8, // UI: Sky blue
  module: 0xfacc15,    // Logic: Yellow/gold
  server: 0xf43f5e,    // Server: Coral red
  config: 0x4ade80,    // Config: Lime green
  type: 0xc084fc,      // Type: Purple
}

function getClusterColor(clusterKey: string, kind?: string): number {
  if (kind && KIND_COLORS[kind]) {
    return KIND_COLORS[kind]
  }
  let hash = 0
  for (let i = 0; i < clusterKey.length; i++) {
    hash = (hash << 5) - hash + clusterKey.charCodeAt(i)
    hash |= 0
  }
  return CLUSTER_COLORS[Math.abs(hash) % CLUSTER_COLORS.length]
}

// Generate soft radial glow texture for hub auras
function createGlowTexture(hexColor: number): CanvasTexture {
  const canvas = document.createElement("canvas")
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext("2d")
  if (ctx) {
    const c = new Color(hexColor)
    const r = Math.round(c.r * 255)
    const g = Math.round(c.g * 255)
    const b = Math.round(c.b * 255)

    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.85)`)
    grad.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, 0.4)`)
    grad.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, 0.1)`)
    grad.addColorStop(1, "rgba(0, 0, 0, 0)")

    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 128, 128)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function createTextSprite(text: string, color: string, fontSize = 22): Sprite {
  const canvas = document.createElement("canvas")
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext("2d")
  if (ctx) {
    ctx.clearRect(0, 0, 256, 64)
    ctx.font = `bold ${fontSize}px ui-monospace, Menlo, Monaco, Consolas, monospace`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillStyle = color
    ctx.shadowColor = "rgba(0, 0, 0, 0.9)"
    ctx.shadowBlur = 6
    ctx.fillText(text.length > 20 ? `${text.slice(0, 18)}…` : text, 128, 32)
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  const spriteMat = new SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  })
  const sprite = new Sprite(spriteMat)
  sprite.scale.set(18, 4.5, 1)
  return sprite
}

interface SimNode {
  id: string
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  degree: number
  cluster: string
  data: GraphNode["data"]
}

// 3D Organic Clustered Force Layout Simulation (matching reference image)
function simulate3DForceLayout(
  nodes: GraphNode[],
  edges: { data: { source: string; target: string } }[],
  iterations = 100,
): Map<string, Vector3> {
  const simNodes: SimNode[] = []
  const nodeMap = new Map<string, SimNode>()

  // Cluster grouping by directory / package
  const clusterAnchors = new Map<string, Vector3>()
  const clusterCounts = new Map<string, number>()

  for (const n of nodes) {
    const dir = n.data.directory || n.data.kind || "root"
    clusterCounts.set(dir, (clusterCounts.get(dir) || 0) + 1)
  }

  // Position cluster centers in a 3D sphere
  const clusterNames = Array.from(clusterCounts.keys())
  const clusterRadius = Math.max(90, Math.min(240, nodes.length * 2.8))
  const phi = Math.PI * (3 - Math.sqrt(5)) // Golden angle

  clusterNames.forEach((cluster, idx) => {
    const y = 1 - (idx / Math.max(1, clusterNames.length - 1)) * 2
    const rAtY = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = phi * idx
    clusterAnchors.set(
      cluster,
      new Vector3(
        Math.cos(theta) * rAtY * clusterRadius,
        y * clusterRadius * 0.75,
        Math.sin(theta) * rAtY * clusterRadius,
      ),
    )
  })

  // Initialize node positions near cluster anchors with radial jitter
  for (const n of nodes) {
    const cluster = n.data.directory || n.data.kind || "root"
    const anchor = clusterAnchors.get(cluster) || new Vector3()
    const jitter = 35

    const simNode: SimNode = {
      id: n.data.id,
      x: anchor.x + (Math.random() - 0.5) * jitter,
      y: anchor.y + (Math.random() - 0.5) * jitter,
      z: anchor.z + (Math.random() - 0.5) * jitter,
      vx: 0,
      vy: 0,
      vz: 0,
      degree: n.data.degree ?? 0,
      cluster,
      data: n.data,
    }
    simNodes.push(simNode)
    nodeMap.set(simNode.id, simNode)
  }

  // Pre-filter valid edge pairs
  const validEdges: [SimNode, SimNode][] = []
  for (const e of edges) {
    const s = nodeMap.get(e.data.source)
    const t = nodeMap.get(e.data.target)
    if (s && t && s !== t) {
      validEdges.push([s, t])
    }
  }

  // Run 3D Force Simulation Loop
  const kRepulsion = 1400
  const kSpring = 0.05
  const restLength = 45
  let temp = 1.0

  for (let step = 0; step < iterations; step++) {
    // 1. Repulsion between all nodes (Coulomb)
    for (let i = 0; i < simNodes.length; i++) {
      const a = simNodes[i]
      for (let j = i + 1; j < simNodes.length; j++) {
        const b = simNodes[j]
        const dx = a.x - b.x
        const dy = a.y - b.y
        const dz = a.z - b.z
        const distSq = dx * dx + dy * dy + dz * dz + 4.0
        const dist = Math.sqrt(distSq)
        if (dist > 300) continue

        const force = (kRepulsion / distSq) * temp
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        const fz = (dz / dist) * force

        a.vx += fx
        a.vy += fy
        a.vz += fz
        b.vx -= fx
        b.vy -= fy
        b.vz -= fz
      }
    }

    // 2. Spring attraction along edges (Hooke's Law)
    for (const [s, t] of validEdges) {
      const dx = t.x - s.x
      const dy = t.y - s.y
      const dz = t.z - s.z
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01
      const displacement = dist - restLength
      const force = displacement * kSpring * temp

      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      const fz = (dz / dist) * force

      s.vx += fx
      s.vy += fy
      s.vz += fz
      t.vx -= fx
      t.vy -= fy
      t.vz -= fz
    }

    // 3. Centering gravity & position update with velocity damping
    for (const n of simNodes) {
      const distToCenter = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z) + 0.1
      n.vx -= (n.x / distToCenter) * 0.4
      n.vy -= (n.y / distToCenter) * 0.4
      n.vz -= (n.z / distToCenter) * 0.4

      n.x += n.vx * 0.5
      n.y += n.vy * 0.5
      n.z += n.vz * 0.5

      n.vx *= 0.55
      n.vy *= 0.55
      n.vz *= 0.55
    }

    temp *= 0.96
  }

  const result = new Map<string, Vector3>()
  for (const n of simNodes) {
    result.set(n.id, new Vector3(n.x, n.y, n.z))
  }
  return result
}

export const KnowledgeGraph3D: Component<{
  data: GraphData
  isDark: () => boolean
  selectedNodeId?: string | null
  searchQuery?: string
  activeFilter?: string
  isAutoRotating?: boolean
  onSelectNode?: (nodeData: GraphNode["data"]) => void
}> = (props) => {
  let containerRef: HTMLDivElement | undefined
  let renderer: WebGLRenderer | null = null
  let scene: Scene | null = null
  let camera: PerspectiveCamera | null = null
  let controls: OrbitControls | null = null
  let animationFrameId: number | null = null
  let resizeObserver: ResizeObserver | null = null

  const nodeMeshes = new Map<string, Mesh>()
  const nodeSprites = new Map<string, Sprite>()
  const haloSprites = new Map<string, Sprite>()
  const nodeDataMap = new Map<string, GraphNode["data"]>()
  const nodePositions = new Map<string, Vector3>()

  // Graph adjacency map for neighborhood highlighting
  const adjacency = new Map<string, Set<string>>()

  let edgeLinesMesh: LineSegments | null = null
  let edgeColorsAttribute: Float32BufferAttribute | null = null
  let originalEdgeColors: Float32Array | null = null
  let edgeIndexMap: { src: string; tgt: string; startIndex: number }[] = []

  let hoverNodeId: string | null = null

  onMount(() => {
    if (!containerRef) return

    const width = containerRef.clientWidth || 800
    const height = containerRef.clientHeight || 600

    scene = new Scene()
    camera = new PerspectiveCamera(55, width / height, 0.1, 3000)
    camera.position.set(0, 60, 280)

    renderer = new WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.outputColorSpace = SRGBColorSpace
    containerRef.appendChild(renderer.domElement)

    controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.rotateSpeed = 0.85
    controls.zoomSpeed = 1.3
    controls.panSpeed = 0.8
    controls.minDistance = 15
    controls.maxDistance = 1200

    // Cinematic deep space neural lighting
    const ambientLight = new AmbientLight(0xffffff, 1.1)
    scene.add(ambientLight)

    const dirLight1 = new DirectionalLight(0xfff8ee, 1.4)
    dirLight1.position.set(150, 200, 150)
    scene.add(dirLight1)

    const dirLight2 = new DirectionalLight(0x60a5fa, 0.9)
    dirLight2.position.set(-150, -150, -150)
    scene.add(dirLight2)

    // Ambient floating star dust in background
    const dustCount = 800
    const dustGeo = new BufferGeometry()
    const dustPositions = new Float32Array(dustCount * 3)
    for (let i = 0; i < dustCount * 3; i += 3) {
      dustPositions[i] = (Math.random() - 0.5) * 800
      dustPositions[i + 1] = (Math.random() - 0.5) * 800
      dustPositions[i + 2] = (Math.random() - 0.5) * 800
    }
    dustGeo.setAttribute("position", new Float32BufferAttribute(dustPositions, 3))
    const dustMat = new PointsMaterial({
      color: 0x94a3b8,
      size: 1.2,
      transparent: true,
      opacity: 0.25,
    })
    const dustPoints = new Points(dustGeo, dustMat)
    scene.add(dustPoints)

    // Raycasting for interactive hover and selection
    const raycaster = new Raycaster()
    const mouse = new Vector2()

    const updateHighlight = (targetId: string | null) => {
      const activeId = targetId || props.selectedNodeId || null

      if (!activeId) {
        // Reset all nodes, halos, and edges to normal
        for (const [id, mesh] of nodeMeshes.entries()) {
          mesh.scale.set(1, 1, 1)
          const mat = mesh.material as MeshStandardMaterial
          mat.opacity = 1.0
        }
        for (const sprite of haloSprites.values()) {
          sprite.visible = true
        }
        for (const [id, sprite] of nodeSprites.entries()) {
          const data = nodeDataMap.get(id)
          sprite.visible = Boolean((data?.degree ?? 0) >= 4)
        }
        if (edgeColorsAttribute && originalEdgeColors) {
          edgeColorsAttribute.copyArray(originalEdgeColors)
          edgeColorsAttribute.needsUpdate = true
        }
        return
      }

      const neighbors = adjacency.get(activeId) || new Set<string>()

      for (const [id, mesh] of nodeMeshes.entries()) {
        const isSelf = id === activeId
        const isNeighbor = neighbors.has(id)
        const mat = mesh.material as MeshStandardMaterial

        if (isSelf) {
          mesh.scale.set(1.4, 1.4, 1.4)
          mat.opacity = 1.0
        } else if (isNeighbor) {
          mesh.scale.set(1.2, 1.2, 1.2)
          mat.opacity = 0.95
        } else {
          mesh.scale.set(0.9, 0.9, 0.9)
          mat.opacity = 0.2
        }
      }

      // Show labels for self and neighbors
      for (const [id, sprite] of nodeSprites.entries()) {
        sprite.visible = id === activeId || neighbors.has(id)
      }

      // Halos
      for (const [id, sprite] of haloSprites.entries()) {
        sprite.visible = id === activeId || neighbors.has(id)
      }

      // Highlight active edges, dim others
      if (edgeColorsAttribute && originalEdgeColors) {
        const currentArr = edgeColorsAttribute.array as Float32Array
        for (const item of edgeIndexMap) {
          const connected =
            (item.src === activeId && neighbors.has(item.tgt)) ||
            (item.tgt === activeId && neighbors.has(item.src))

          const idx = item.startIndex
          for (let v = 0; v < 6; v++) {
            if (connected) {
              // Bright golden highlight for active connected edges
              currentArr[idx + v * 3] = 1.0
              currentArr[idx + v * 3 + 1] = 0.85
              currentArr[idx + v * 3 + 2] = 0.25
            } else {
              // Dim disconnected edges
              currentArr[idx + v * 3] = originalEdgeColors[idx + v * 3] * 0.15
              currentArr[idx + v * 3 + 1] = originalEdgeColors[idx + v * 3 + 1] * 0.15
              currentArr[idx + v * 3 + 2] = originalEdgeColors[idx + v * 3 + 2] * 0.15
            }
          }
        }
        edgeColorsAttribute.needsUpdate = true
      }
    }

    const onPointerMove = (e: MouseEvent) => {
      if (!containerRef || !camera) return
      const rect = containerRef.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)
      const meshes = Array.from(nodeMeshes.values())
      const intersects = raycaster.intersectObjects(meshes)

      if (intersects.length > 0) {
        containerRef.style.cursor = "pointer"
        const hit = intersects[0].object as Mesh
        const hitId = hit.userData.nodeId
        if (hitId !== hoverNodeId) {
          hoverNodeId = hitId
          updateHighlight(hoverNodeId)
        }
      } else {
        containerRef.style.cursor = "grab"
        if (hoverNodeId) {
          hoverNodeId = null
          updateHighlight(null)
        }
      }
    }

    const onPointerDown = () => {
      if (containerRef) containerRef.style.cursor = "grabbing"
    }

    const onPointerUp = () => {
      if (containerRef) containerRef.style.cursor = "grab"
    }

    const onClick = (e: MouseEvent) => {
      if (!containerRef || !camera) return
      const rect = containerRef.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)
      const meshes = Array.from(nodeMeshes.values())
      const intersects = raycaster.intersectObjects(meshes)

      if (intersects.length > 0) {
        const hit = intersects[0].object as Mesh
        const nodeId = hit.userData.nodeId
        if (nodeId && nodeDataMap.has(nodeId)) {
          props.onSelectNode?.(nodeDataMap.get(nodeId)!)
          updateHighlight(nodeId)
        }
      }
    }

    containerRef.addEventListener("mousemove", onPointerMove)
    containerRef.addEventListener("mousedown", onPointerDown)
    containerRef.addEventListener("mouseup", onPointerUp)
    containerRef.addEventListener("click", onClick)

    // Animation Loop
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)

      if (controls) {
        controls.autoRotate = Boolean(props.isAutoRotating)
        controls.autoRotateSpeed = 1.0
        controls.update()
      }

      // Slow celestial rotation of background dust
      dustPoints.rotation.y += 0.0003
      dustPoints.rotation.x += 0.00015

      if (renderer && scene && camera) {
        renderer.render(scene, camera)
      }
    }
    animate()

    // Resize handling
    resizeObserver = new ResizeObserver(() => {
      if (!containerRef || !renderer || !camera) return
      const w = containerRef.clientWidth || 800
      const h = containerRef.clientHeight || 600
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    })
    resizeObserver.observe(containerRef)

    onCleanup(() => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
      if (resizeObserver) resizeObserver.disconnect()
      containerRef?.removeEventListener("mousemove", onPointerMove)
      containerRef?.removeEventListener("mousedown", onPointerDown)
      containerRef?.removeEventListener("mouseup", onPointerUp)
      containerRef?.removeEventListener("click", onClick)
      if (renderer && renderer.domElement) {
        renderer.dispose()
        containerRef?.removeChild(renderer.domElement)
      }
    })
  })

  // Build / update 3D graph scene with organic 3D force simulation
  createEffect(() => {
    if (!scene) return

    const data = props.data
    const dark = props.isDark()
    const query = (props.searchQuery || "").toLowerCase()
    const filter = props.activeFilter || "all"

    // Background color: Deep Obsidian space in dark mode, crisp paper in light mode
    scene.background = new Color(dark ? 0x070503 : 0xfaf8f5)

    // Clean up previous elements
    for (const mesh of nodeMeshes.values()) {
      scene.remove(mesh)
      mesh.geometry.dispose()
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose())
      } else {
        mesh.material.dispose()
      }
    }
    nodeMeshes.clear()

    for (const sprite of nodeSprites.values()) {
      scene.remove(sprite)
      sprite.material.dispose()
    }
    nodeSprites.clear()

    for (const halo of haloSprites.values()) {
      scene.remove(halo)
      halo.material.dispose()
    }
    haloSprites.clear()

    nodeDataMap.clear()
    nodePositions.clear()
    adjacency.clear()

    if (edgeLinesMesh) {
      scene.remove(edgeLinesMesh)
      edgeLinesMesh.geometry.dispose()
      ;(edgeLinesMesh.material as LineBasicMaterial).dispose()
      edgeLinesMesh = null
      edgeColorsAttribute = null
      originalEdgeColors = null
      edgeIndexMap = []
    }

    if (!data.nodes.length) return

    // Filter nodes
    const filteredNodes = data.nodes.filter((node) => {
      const matchKind = filter === "all" || node.data.kind === filter
      const matchSearch =
        !query ||
        node.data.label.toLowerCase().includes(query) ||
        node.data.path.toLowerCase().includes(query)
      return matchKind && matchSearch
    })

    const visibleNodeIds = new Set(filteredNodes.map((n) => n.data.id))

    // Build adjacency mapping
    for (const node of filteredNodes) {
      adjacency.set(node.data.id, new Set<string>())
    }
    for (const edge of data.edges) {
      if (visibleNodeIds.has(edge.data.source) && visibleNodeIds.has(edge.data.target)) {
        adjacency.get(edge.data.source)?.add(edge.data.target)
        adjacency.get(edge.data.target)?.add(edge.data.source)
      }
    }

    // Run 3D Organic Force Simulation (clustering, hub-and-spoke starbursts)
    const simulatedPositions = simulate3DForceLayout(filteredNodes, data.edges, 110)

    // Render 3D Spheres & Glowing Hubs
    filteredNodes.forEach((node) => {
      nodeDataMap.set(node.data.id, node.data)
      const pos = simulatedPositions.get(node.data.id) || new Vector3()
      nodePositions.set(node.data.id, pos)

      const degree = node.data.degree ?? 0
      const clusterKey = node.data.directory || node.data.kind || "root"
      const colorHex = getClusterColor(clusterKey, node.data.kind)

      // Radius scaling matching the image:
      // Hubs are prominent (5.5 - 7.5), medium nodes (3.0 - 4.5), satellites (1.8 - 2.5)
      const baseRadius = Math.max(2.0, Math.min(7.2, 2.0 + degree * 0.45))

      const sphereGeo = new SphereGeometry(baseRadius, 24, 24)
      const sphereMat = new MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: dark ? 0.65 : 0.45,
        roughness: 0.2,
        metalness: 0.35,
        transparent: true,
        opacity: 1.0,
      })

      const mesh = new Mesh(sphereGeo, sphereMat)
      mesh.position.copy(pos)
      mesh.userData = { nodeId: node.data.id }
      scene.add(mesh)
      nodeMeshes.set(node.data.id, mesh)

      // Soft glowing aura for major hubs (degree >= 3)
      if (degree >= 3) {
        const glowTex = createGlowTexture(colorHex)
        const glowMat = new SpriteMaterial({
          map: glowTex,
          transparent: true,
          opacity: dark ? 0.55 : 0.35,
          blending: AdditiveBlending,
          depthWrite: false,
        })
        const haloSprite = new Sprite(glowMat)
        const haloScale = baseRadius * 3.8
        haloSprite.scale.set(haloScale, haloScale, 1)
        haloSprite.position.copy(pos)
        scene.add(haloSprite)
        haloSprites.set(node.data.id, haloSprite)
      }

      // Billboard Text Label
      const labelColor = dark ? "#f1f5f9" : "#1e293b"
      const sprite = createTextSprite(node.data.label, labelColor)
      sprite.position.set(pos.x, pos.y - baseRadius - 3.8, pos.z)
      // Hubs show label by default, others show on hover/select
      sprite.visible = degree >= 4
      scene.add(sprite)
      nodeSprites.set(node.data.id, sprite)
    })

    // Render 3D Neural Edges with Vertex Colors
    const linePositions: number[] = []
    const lineColors: number[] = []
    edgeIndexMap = []

    for (const edge of data.edges) {
      const srcId = edge.data.source
      const tgtId = edge.data.target
      if (visibleNodeIds.has(srcId) && visibleNodeIds.has(tgtId)) {
        const srcPos = nodePositions.get(srcId)
        const tgtPos = nodePositions.get(tgtId)
        if (srcPos && tgtPos) {
          const startIndex = linePositions.length
          edgeIndexMap.push({ src: srcId, tgt: tgtId, startIndex })

          linePositions.push(srcPos.x, srcPos.y, srcPos.z)
          linePositions.push(tgtPos.x, tgtPos.y, tgtPos.z)

          // Edge color blends subtly between source and target clusters
          const srcNode = nodeDataMap.get(srcId)
          const tgtNode = nodeDataMap.get(tgtId)
          const c1 = new Color(
            getClusterColor(srcNode?.directory || "root", srcNode?.kind),
          )
          const c2 = new Color(
            getClusterColor(tgtNode?.directory || "root", tgtNode?.kind),
          )

          // Subdued opacity tint for lines like the reference image
          const blendFactor = dark ? 0.55 : 0.4
          lineColors.push(c1.r * blendFactor, c1.g * blendFactor, c1.b * blendFactor)
          lineColors.push(c2.r * blendFactor, c2.g * blendFactor, c2.b * blendFactor)
        }
      }
    }

    if (linePositions.length > 0) {
      const lineGeo = new BufferGeometry()
      lineGeo.setAttribute("position", new Float32BufferAttribute(linePositions, 3))
      edgeColorsAttribute = new Float32BufferAttribute(lineColors, 3)
      originalEdgeColors = new Float32Array(lineColors)
      lineGeo.setAttribute("color", edgeColorsAttribute)

      const lineMat = new LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: dark ? 0.6 : 0.75,
        depthWrite: false,
      })
      edgeLinesMesh = new LineSegments(lineGeo, lineMat)
      scene.add(edgeLinesMesh)
    }
  })

  return (
    <div class="relative w-full h-full select-none overflow-hidden">
      <div ref={containerRef} class="w-full h-full cursor-grab active:cursor-grabbing" />
      {/* 3D Neural Axis Helper Hint */}
      <div
        class="absolute bottom-3 left-4 z-10 pointer-events-none flex items-center gap-2 text-[10px] font-mono px-2.5 py-1 rounded-lg border backdrop-blur-md shadow-lg"
        classList={{
          "bg-[#0a0705]/85 text-[#94a3b8] border-[#291f14]": props.isDark(),
          "bg-[#faf6f0]/90 text-[#475569] border-[#ded3c3]": !props.isDark(),
        }}
      >
        <span class="inline-block w-2 h-2 rounded-full bg-[#4ade80] animate-pulse" />
        <span>Drag: 3D Orbit</span>
        <span>·</span>
        <span>Scroll: Zoom</span>
        <span>·</span>
        <span>Click: Inspect Node</span>
      </div>
    </div>
  )
}
