import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, ImageIcon } from 'lucide-react'
import { fetchCollectionSummary } from '@/common/api/works'
import { getYearlyRecap } from '@/common/api/insights'
import { getShareValue } from '@/common/api/share'
import { queryKeys } from '@/common/lib/queryKeys'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { useNow } from '@/common/hooks/useNow'
import { contenuBilan, dessinerBilan, nomDuFichier } from './bilanImage'

/** The vivid tone of the cover on screen, for the accent of the image; terracotta otherwise. */
function accentCourant(): string {
  const valeur = getComputedStyle(document.documentElement).getPropertyValue('--teinte-vive').trim()
  return valeur || 'rgb(217 153 135)'
}

/**
 * "Mon bilan en image" (lot 217): a PNG to share elsewhere, made entirely in
 * the browser from the big numbers of the year and a few covers. Nothing is
 * sent to a server to draw it. The covers come through the app's own cover
 * route, so the image can be exported; one that cannot be read is left out.
 */
export function BlocBilan({ jaquettes }: { jaquettes: string[] }) {
  const annee = useNow().getFullYear()
  const resume = useQuery({ queryKey: queryKeys.works.summary, queryFn: fetchCollectionSummary })
  const recap = useQuery({ queryKey: queryKeys.insights.yearlyRecap(annee), queryFn: () => getYearlyRecap(annee) })
  const valeur = useQuery({ queryKey: queryKeys.shareValue, queryFn: getShareValue })
  const [image, setImage] = useState<{ url: string; blob: Blob } | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [echec, setEchec] = useState(false)

  useEffect(() => () => {
    if (image) URL.revokeObjectURL(image.url)
  }, [image])

  const pret = !resume.isPending && !recap.isPending && !valeur.isPending
  const contenu = contenuBilan({
    annee,
    resume: resume.data ?? null,
    recap: recap.data ?? null,
    valeur: valeur.data ?? null,
  })

  async function creer() {
    setEnCours(true)
    setEchec(false)
    const blob = await dessinerBilan(contenu, jaquettes, accentCourant())
    setEnCours(false)
    if (!blob) {
      setEchec(true)
      return
    }
    setImage({ url: URL.createObjectURL(blob), blob })
  }

  return (
    <section aria-labelledby="titre-bilan" className="iozy-verre iozy-verre--fort flex flex-col gap-3 rounded-3xl p-5">
      <h2 id="titre-bilan" className="flex items-center gap-2 font-display text-xl font-bold text-textPrimary">
        <ImageIcon size={20} aria-hidden="true" />
        Mon bilan en image
      </h2>
      <p className="text-sm text-textDim">
        {contenu.titre} :{' '}
        {contenu.chiffres.length > 0
          ? contenu.chiffres.map((c) => `${c.valeur} ${c.libelle}`).join(' · ')
          : 'les chiffres arrivent…'}
      </p>
      {!valeur.isPending && !valeur.data && (
        <p className="text-xs text-textDim">
          Sans valeur estimée : il faut au moins 5 objets avec un prix, et la moitié de ta collection.
        </p>
      )}
      {echec && <ErrorBanner message="L’image n’a pas pu être dessinée dans ce navigateur." />}
      {image && (
        <img
          src={image.url}
          alt={`Aperçu de ton bilan : ${contenu.titre}`}
          className="w-full max-w-[280px] rounded-2xl shadow-lg"
        />
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondaire" onClick={creer} disabled={!pret || enCours}>
          {enCours ? 'Dessin…' : image ? 'Redessiner l’image' : 'Créer l’image'}
        </button>
        {image && (
          <a href={image.url} download={nomDuFichier(annee)} className="btn-primaire">
            <Download size={16} />
            Télécharger l’image
          </a>
        )}
      </div>
    </section>
  )
}
