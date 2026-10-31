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
  PointLight,
  DirectionalLight,
  SphereGeometry,
  MeshStandardMaterial,
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
} from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import type { GraphData, GraphNode } from "./scanner"

const KIND_COLORS: Record<string, number> = {
  component: 0x38bdf8,
  module: 0xe5a93c,
  server: 0xf43f5e,
  config: 0x10b981,
  type: 0xa855f7,
}

const KIND_HEX: Record<string, string> = {
  component: "#38bdf8",
  module: "#e5a93c",
  server: "#f43f5e",
  config: "#10b981",
  type: "#a855f7",
}

function createTextSprite(text: string, color: string): Sprite {
  const canvas = document.createElement("canvas")
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext("2d")
  if (ctx) {
    ctx.clearRect(0, 0, 256, 64)
    ctx.font = "bold 22px ui-monospace, Menlo, Monaco, Consolas, monospace"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillStyle = color
    ctx.fillText(text.length > 18 ? `${text.slice(0, 16)}…` : text, 128, 32)
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  const spriteMat = new SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  })
  const sprite = new Sprite(spriteMat)
  sprite.scale.set(16, 4, 1)
  return sprite
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
  const nodeDataMap = new Map<string, GraphNode["data"]>()
  const nodePositions = new Map<string, Vector3>()

  let edgeLinesMesh: LineSegments | null = null
  let hoverMesh: Mesh | null = null

  onMount(() => {
    if (!containerRef) return

    const width = containerRef.clientWidth || 800
    const height = containerRef.clientHeight || 600

    scene = new Scene()
    camera = new PerspectiveCamera(60, width / height, 0.1, 2000)
    camera.position.set(0, 50, 220)

    renderer = new WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.outputColorSpace = SRGBColorSpace
    containerRef.appendChild(renderer.domElement)

    controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.rotateSpeed = 0.8
    controls.zoomSpeed = 1.2
    controls.panSpeed = 0.8
    controls.minDistance = 20
    controls.maxDistance = 800

    // Lighting
    const ambientLight = new AmbientLight(0xffffff, 0.9)
    scene.add(ambientLight)

    const dirLight1 = new DirectionalLight(0xfff4e6, 1.2)
    dirLight1.position.set(100, 150, 100)
    scene.add(dirLight1)

    const dirLight2 = new DirectionalLight(0xe5a93c, 0.8)
    dirLight2.position.set(-100, -100, -100)
    scene.add(dirLight2)

    // Background neural dust particles
    const particleCount = 600
    const particleGeo = new BufferGeometry()
    const particlePositions = new Float32Array(particleCount * 3)
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 600
      particlePositions[i + 1] = (Math.random() - 0.5) * 600
      particlePositions[i + 2] = (Math.random() - 0.5) * 600
    }
    particleGeo.setAttribute("position", new Float32BufferAttribute(particlePositions, 3))
    const particleMat = new PointsMaterial({
      color: 0xe5a93c,
      size: 1.5,
      transparent: true,
      opacity: 0.35,
    })
    const dustPoints = new Points(particleGeo, particleMat)
    scene.add(dustPoints)

    // Raycaster for interaction
    const raycaster = new Raycaster()
    const mouse = new Vector2()

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
        if (hoverMesh && hoverMesh !== hit) {
          hoverMesh.scale.set(1, 1, 1)
        }
        hoverMesh = hit
        hoverMesh.scale.set(1.25, 1.25, 1.25)
      } else {
        containerRef.style.cursor = "grab"
        if (hoverMesh) {
          hoverMesh.scale.set(1, 1, 1)
          hoverMesh = null
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

      // Slowly rotate background dust for cinematic neural net effect
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

  // Build / update 3D graph scene whenever data, filter, or theme changes
  createEffect(() => {
    if (!scene) return

    const data = props.data
    const dark = props.isDark()
    const query = (props.searchQuery || "").toLowerCase()
    const filter = props.activeFilter || "all"

    // Update scene background color
    scene.background = new Color(dark ? 0x080502 : 0xfcfbfa)

    // Clean up previous nodes and edges
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
    nodeDataMap.clear()
    nodePositions.clear()

    if (edgeLinesMesh) {
      scene.remove(edgeLinesMesh)
      edgeLinesMesh.geometry.dispose()
      ;(edgeLinesMesh.material as LineBasicMaterial).dispose()
      edgeLinesMesh = null
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

    // 3D Spatial Layout (Spherical Fibonacci + Force Offset)
    const count = filteredNodes.length
    const radius = Math.max(70, Math.min(220, count * 3.5))
    const phi = Math.PI * (3 - Math.sqrt(5)) // Golden angle

    filteredNodes.forEach((node, idx) => {
      nodeDataMap.set(node.data.id, node.data)

      const y = 1 - (idx / Math.max(1, count - 1)) * 2 // from 1 to -1
      const rAtY = Math.sqrt(1 - y * y)
      const theta = phi * idx

      // Add cluster clustering based on directory/kind
      const kindHash = (node.data.kind || "module").charCodeAt(0) * 12
      const pos = new Vector3(
        Math.cos(theta) * rAtY * radius + (Math.sin(kindHash) * 20),
        y * radius * 0.8 + (Math.cos(kindHash) * 20),
        Math.sin(theta) * rAtY * radius,
      )
      nodePositions.set(node.data.id, pos)

      const kind = node.data.kind ?? "module"
      const colorHex = KIND_COLORS[kind] ?? 0xe5a93c
      const baseRadius = Math.max(2.4, Math.min(6.5, 2.4 + (node.data.degree ?? 0) * 0.4))

      const sphereGeo = new SphereGeometry(baseRadius, 24, 24)
      const sphereMat = new MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 0.45,
        roughness: 0.25,
        metalness: 0.3,
      })

      const mesh = new Mesh(sphereGeo, sphereMat)
      mesh.position.copy(pos)
      mesh.userData = { nodeId: node.data.id }
      scene.add(mesh)
      nodeMeshes.set(node.data.id, mesh)

      // Add floating billboard label
      const labelColor = dark ? "#ede6dd" : "#241e15"
      const sprite = createTextSprite(node.data.label, labelColor)
      sprite.position.set(pos.x, pos.y - baseRadius - 3.5, pos.z)
      scene.add(sprite)
      nodeSprites.set(node.data.id, sprite)
    })

    // 3D Neural Edges
    const linePositions: number[] = []
    for (const edge of data.edges) {
      const srcId = edge.data.source
      const tgtId = edge.data.target
      if (visibleNodeIds.has(srcId) && visibleNodeIds.has(tgtId)) {
        const srcPos = nodePositions.get(srcId)
        const tgtPos = nodePositions.get(tgtId)
        if (srcPos && tgtPos) {
          linePositions.push(srcPos.x, srcPos.y, srcPos.z)
          linePositions.push(tgtPos.x, tgtPos.y, tgtPos.z)
        }
      }
    }

    if (linePositions.length > 0) {
      const lineGeo = new BufferGeometry()
      lineGeo.setAttribute("position", new Float32BufferAttribute(linePositions, 3))
      const lineMat = new LineBasicMaterial({
        color: dark ? 0xf59e0b : 0xb45309,
        transparent: true,
        opacity: dark ? 0.65 : 0.8,
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
        class="absolute bottom-3 left-4 z-10 pointer-events-none flex items-center gap-2 text-[10px] font-mono px-2 py-1 rounded border backdrop-blur-md"
        classList={{
          "bg-[#0e0a07]/80 text-[#8c7e6c] border-[#291f14]": props.isDark(),
          "bg-[#faf6f0]/85 text-[#736350] border-[#ded3c3]": !props.isDark(),
        }}
      >
        <span>Drag: Rotate 3-Axis</span>
        <span>·</span>
        <span>Scroll: Zoom</span>
        <span>·</span>
        <span>Right Click: Pan</span>
      </div>
    </div>
  )
}
