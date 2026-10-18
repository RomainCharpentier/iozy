import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff } from 'lucide-react'

/** Native browser detector (Shape Detection API) - supported in Chrome/Edge/
  * Opera (desktop + Android), missing from Safari and Firefox today. No JS
  * library was added to fill the gap: on an unsupported browser, this
  * component only shows a message, and the existing manual entry (see
  * BarcodeLookupField) is the only fallback. */
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>
}

declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike
  }
}

const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']
/** Avoids firing the same code again while it stays in the frame -
  * without it, pointing the camera at the same volume for 2 seconds adds it in a loop. */
const RESCAN_COOLDOWN_MS = 3000

/**
  * "Quick add by scan" (brainstorm) - scans several barcodes in a row
  * with the camera, one `onScan(code)` per detected code (deduplicated
  * during the cooldown). It does NO lookup or add itself - the
  * parent (ScanPage) orchestrates lookupBarcode + quickAdd, and this component
  * only handles the camera and detection mechanics.
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
        // Best-effort by nature - an unreadable frame must never interrupt the stream.
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
