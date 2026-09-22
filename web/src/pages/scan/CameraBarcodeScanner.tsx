import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff } from 'lucide-react'

/** Détecteur natif du navigateur (Shape Detection API) - support Chrome/Edge/
 * Opera (desktop + Android), absent de Safari et Firefox à ce jour. Pas de
 * librairie JS ajoutée pour combler l'écart : sur un navigateur non
 * supporté, ce composant affiche juste un message et la saisie manuelle
 * existante (voir BarcodeLookupField) reste le seul repli. */
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>
}

declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike
  }
}

const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']
/** Évite de redéclencher le même code pendant qu'il reste dans le cadre -
 * sans ça, pointer la caméra 2 secondes sur un même tome l'ajoute en boucle. */
const RESCAN_COOLDOWN_MS = 3000

/**
 * "Ajout rapide par scan" (brainstorm) - scanne successivement plusieurs
 * codes-barres via la caméra, un `onScan(code)` par code détecté (dédupliqué
 * le temps du cooldown). Ne fait AUCUN lookup/ajout lui-même - c'est au
 * parent (ScanPage) d'orchestrer lookupBarcode + quickAdd, ce composant se
 * limite à la mécanique caméra/détection.
 */
export function CameraBarcodeScanner({ onScan }: { onScan: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<BarcodeDetectorLike | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastSeenRef = useRef<Map<string, number>>(new Map())
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supported = typeof window !== 'undefined' && !!window.BarcodeDetector

  useEffect(() => {
    return () => stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function detectLoop() {
    const video = videoRef.current
    const detector = detectorRef.current
    if (!video || !detector) return

    detector
      .detect(video)
      .then((results) => {
        const now = Date.now()
        for (const result of results) {
          const lastSeen = lastSeenRef.current.get(result.rawValue)
          if (lastSeen && now - lastSeen < RESCAN_COOLDOWN_MS) continue
          lastSeenRef.current.set(result.rawValue, now)
          onScan(result.rawValue)
        }
      })
      .catch(() => {
        // Best-effort par nature - une frame illisible ne doit jamais interrompre le flux.
      })
      .finally(() => {
        rafRef.current = requestAnimationFrame(detectLoop)
      })
  }

  async function start() {
    if (!window.BarcodeDetector) return
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      detectorRef.current = new window.BarcodeDetector({ formats: BARCODE_FORMATS })
      setScanning(true)
      rafRef.current = requestAnimationFrame(detectLoop)
    } catch {
      setError("Impossible d'accéder à la caméra - vérifie les autorisations du navigateur.")
    }
  }

  function stop() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    detectorRef.current = null
    setScanning(false)
  }

  if (!supported) {
    return (
      <p className="rounded-xl bg-surface p-3 text-sm text-textDim">
        Le scan caméra n'est pas supporté par ce navigateur (Chrome/Edge sur Android ou ordinateur uniquement pour
        l'instant) - utilise la recherche par code-barres manuelle ci-dessous à la place.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} className={`w-full ${scanning ? 'block' : 'hidden'}`} muted playsInline />
        {!scanning && <div className="flex h-48 items-center justify-center text-sm text-textDim">Caméra arrêtée</div>}
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <button
        type="button"
        onClick={scanning ? stop : start}
        className="btn-primaire"
      >
        {scanning ? <CameraOff size={16} /> : <Camera size={16} />}
        {scanning ? 'Arrêter le scan' : 'Démarrer le scan'}
      </button>
    </div>
  )
}
