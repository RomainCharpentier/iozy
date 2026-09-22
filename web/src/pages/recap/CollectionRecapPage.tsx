import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { getYearlyRecap } from '@/common/api/insights'
import { queryKeys } from '@/common/lib/queryKeys'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { djb2Hash } from '@/common/theme/gradient'
import { gradientPalettes } from '@/common/theme/tokens'
import type { YearlyRecapDto } from '@/common/types/api'
import { LienRetour } from '@/common/components/LienRetour'
import { formaterDecimal } from '@/common/lib/formats'
import { Squelette } from '@/common/components/Squelette'

/** Même algorithme que gradientFor (theme/gradient.ts), mais renvoie les 2
 * couleurs hexadécimales brutes plutôt qu'une chaîne CSS - nécessaire pour
 * dessiner le dégradé sur un <canvas> (export image), où CSS n'existe pas. */
function gradientColorsFor(key: string): [string, string] {
  const [from, to] = gradientPalettes[djb2Hash(key) % gradientPalettes.length]
  return [`#${from}`, `#${to}`]
}

/** "Bilan annuel" (Mon profil) - « 84 tomes achetés, 12 séries commencées,
 * auteur le plus présent... » en carte visuelle façon "Wrapped". Pas de lien
 * public : aucun système d'authentification n'existe encore dans l'app pour
 * distinguer "moi" de "n'importe qui", donc le partage se fait en
 * téléchargeant l'image générée ci-dessous puis en la diffusant soi-même
 * (réseaux sociaux, message...), jamais via une URL exposant directement les
 * données du propriétaire. */
export function CollectionRecapPage() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const recapQuery = useQuery({
    queryKey: queryKeys.insights.yearlyRecap(year),
    queryFn: () => getYearlyRecap(year),
  })

  const availableYears = useMemo(() => {
    const years = new Set(recapQuery.data?.availableYears ?? [])
    years.add(currentYear)
    return Array.from(years).sort((a, b) => b - a)
  }, [recapQuery.data, currentYear])

  function downloadImage(recap: YearlyRecapDto) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = 1080
    const height = 1350
    canvas.width = width
    canvas.height = height

    const [from, to] = gradientColorsFor(`recap-${recap.year}`)
    const gradient = ctx.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, from)
    gradient.addColorStop(1, to)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    ctx.textBaseline = 'top'
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.font = '600 44px Inter, sans-serif'
    ctx.fillText('Bilan de collection', 72, 100)
    ctx.fillStyle = '#ffffff'
    ctx.font = '700 96px Inter, sans-serif'
    ctx.fillText(String(recap.year), 72, 160)

    let y = 340
    const line = (big: string, small: string) => {
      ctx.fillStyle = '#ffffff'
      ctx.font = '700 88px Inter, sans-serif'
      ctx.fillText(big, 72, y)
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.font = '400 34px Inter, sans-serif'
      ctx.fillText(small, 72, y + 96)
      y += 190
    }

    line(String(recap.acquisitionsCount), recap.acquisitionsCount > 1 ? 'ajouts à la collection' : 'ajout à la collection')
    line(String(recap.seriesStartedCount), recap.seriesStartedCount > 1 ? 'titres commencés' : 'titre commencé')
    line(
      String(recap.experiencesCount) + (recap.averageRating !== null ? ` (${formaterDecimal(recap.averageRating)}/10)` : ''),
      recap.experiencesCount > 1 ? 'expériences enregistrées' : 'expérience enregistrée',
    )

    if (recap.mostFeaturedCreator) {
      ctx.fillStyle = '#ffffff'
      ctx.font = '700 52px Inter, sans-serif'
      ctx.fillText(recap.mostFeaturedCreator, 72, y)
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.font = '400 34px Inter, sans-serif'
      ctx.fillText('auteur/studio le plus présent', 72, y + 68)
    }

    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.font = '400 28px Inter, sans-serif'
    ctx.fillText('IozyCore', 72, height - 80)

    const link = document.createElement('a')
    link.download = `bilan-${recap.year}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <div className="flex flex-col gap-5">
      <LienRetour parDefaut={{ to: '/discover', libelle: 'Découvrir' }} />

      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-[-0.025em] text-textPrimary">Bilan annuel</h1>
        <select
          aria-label="Année du bilan"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="champ"
        >
          {availableYears.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {recapQuery.isError && <ErrorBanner message={recapQuery.error.message} />}
      {recapQuery.isLoading && <Squelette lignes={3} />}

      {recapQuery.data && (
        <>
          <div
            className="flex flex-col gap-4 rounded-2xl p-6 text-white"
            style={{ background: `linear-gradient(135deg, ${gradientColorsFor(`recap-${year}`).join(', ')})` }}
          >
            <p className="text-sm font-medium text-white/85">Bilan de collection {recapQuery.data.year}</p>

            {recapQuery.data.acquisitionsCount === 0 ? (
              <p className="text-white/85">
                Rien à raconter pour {year} - pas d'ajout enregistré cette année-là.
              </p>
            ) : (
              <>
                <div>
                  <p className="font-display text-5xl font-bold">{recapQuery.data.acquisitionsCount}</p>
                  <p className="text-sm text-white/85">
                    {recapQuery.data.acquisitionsCount > 1 ? 'ajouts à la collection' : 'ajout à la collection'}
                  </p>
                </div>
                <div>
                  <p className="font-display text-5xl font-bold">{recapQuery.data.seriesStartedCount}</p>
                  <p className="text-sm text-white/85">
                    {recapQuery.data.seriesStartedCount > 1 ? 'titres commencés' : 'titre commencé'}
                  </p>
                </div>
                <div>
                  <p className="font-display text-5xl font-bold">
                    {recapQuery.data.experiencesCount}
                    {recapQuery.data.averageRating !== null && (
                      <span className="ml-2 text-2xl font-normal text-white/85">
                        ({formaterDecimal(recapQuery.data.averageRating)}/10)
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-white/85">
                    {recapQuery.data.experiencesCount > 1 ? 'expériences enregistrées' : 'expérience enregistrée'}
                  </p>
                </div>
                {recapQuery.data.mostFeaturedCreator && (
                  <div>
                    <p className="font-display text-2xl font-bold">{recapQuery.data.mostFeaturedCreator}</p>
                    <p className="text-sm text-white/85">
                      auteur/studio le plus présent ({recapQuery.data.mostFeaturedCreatorCount}x)
                    </p>
                  </div>
                )}
                {recapQuery.data.acquisitionsByType.length > 1 && (
                  <p className="text-sm text-white/85">
                    {recapQuery.data.acquisitionsByType.map((t) => `${t.entityTypeLabel} ${t.count}`).join(' · ')}
                  </p>
                )}
              </>
            )}
          </div>

          {recapQuery.data.acquisitionsCount > 0 && (
            <button
              type="button"
              onClick={() => downloadImage(recapQuery.data)}
              className="btn-primaire"
            >
              <Download size={16} />
              Télécharger l'image
            </button>
          )}
        </>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
