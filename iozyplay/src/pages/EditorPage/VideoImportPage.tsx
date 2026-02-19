import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import {
  isYouTubePlaylistUrl,
  isYouTubeUrl,
  getPlaylistVideos,
  getYouTubeMetadata,
  type PlaylistVideo,
} from '@/utils/youtube'
import type { Category, CategoryInfo, Question } from '@/types'
import { loadCategories } from '@/services/categoryService'
import { QuestionService } from '@/services/questionService'
import '../../styles/index.css'
import '../../styles/video-import-page.css'

interface VideoWithAnswer {
  videoId: string
  videoUrl: string
  title: string
  thumbnailUrl: string
  answer: string
  hint?: string
  selected: boolean
}

export default function VideoImportPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const [videoUrl, setVideoUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [videos, setVideos] = useState<VideoWithAnswer[]>([])
  const [categories, setCategories] = useState<CategoryInfo[]>([])
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([])
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [isPlaylist, setIsPlaylist] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 })

  // États pour les confirmations
  const [confirmState, setConfirmState] = useState<{
    type: 'replace' | 'replaceVideo' | 'remove' | 'import' | 'clear' | null
    message: string
    onConfirm: () => void
  }>({ type: null, message: '', onConfirm: () => {} })

  useEffect(() => {
    loadCategoriesList()
  }, [])

  const loadCategoriesList = async () => {
    try {
      const cats = await loadCategories()
      setCategories(cats)
    } catch (error) {
      console.error('Erreur lors du chargement des catégories:', error)
      toast.error('Erreur lors du chargement des catégories')
    }
  }

  // Détecter si c'est une playlist ou une vidéo unique
  useEffect(() => {
    if (videoUrl.trim()) {
      setIsPlaylist(isYouTubePlaylistUrl(videoUrl))
    } else {
      setIsPlaylist(false)
    }
  }, [videoUrl])

  // Fonction pour charger une vidéo/playlist
  const loadVideo = useCallback(
    async (url: string) => {
      if (!url.trim()) {
        return
      }

      if (!isYouTubeUrl(url)) {
        return
      }

      // Demander confirmation si on a déjà des vidéos
      if (videos.length > 0) {
        const isPlaylistUrl = isYouTubePlaylistUrl(url)
        const confirmMessage = isPlaylistUrl
          ? 'Charger cette playlist va remplacer toutes les vidéos actuellement chargées. Continuer ?'
          : 'Charger cette vidéo va remplacer toutes les vidéos actuellement chargées. Continuer ?'
        setConfirmState({
          type: isPlaylistUrl ? 'replace' : 'replaceVideo',
          message: confirmMessage,
          onConfirm: () => {
            setConfirmState({ type: null, message: '', onConfirm: () => {} })
            loadVideoInternal(url)
          },
        })
        return
      }

      loadVideoInternal(url)
    },
    [videos]
  )

  const loadVideoInternal = useCallback(
    async (url: string) => {
      setLoading(true)
      try {
        const isPlaylistUrl = isYouTubePlaylistUrl(url)
        if (isPlaylistUrl) {
          // Mode playlist
          const playlistVideos = await getPlaylistVideos(url)

          if (playlistVideos.length === 0) {
            toast.error(
              'Cette playlist ne contient aucune vidéo ou est inaccessible. Vérifiez que la playlist est publique.'
            )
            setLoading(false)
            return
          }

          const videosWithAnswers: VideoWithAnswer[] = playlistVideos.map((video) => ({
            ...video,
            answer: video.title,
            selected: true,
            hint: undefined,
          }))

          setVideos(videosWithAnswers)
          setVideoUrl('') // Réinitialiser l'URL après chargement
          setEditingIndex(null) // Réinitialiser l'édition
          toast.success(`${playlistVideos.length} vidéo(s) chargée(s)`)
        } else {
          // Mode vidéo unique
          const metadata = await getYouTubeMetadata(url)
          if (!metadata) {
            toast.error(
              "Impossible de récupérer les informations de la vidéo. Vérifiez que l'URL est correcte et que la vidéo est accessible."
            )
            setLoading(false)
            return
          }

          // Vérifier les doublons (même si on remplace, on informe l'utilisateur)
          const existingVideo = videos.find((v) => v.videoId === metadata.videoId)
          if (existingVideo) {
            setLoading(false)
            setConfirmState({
              type: 'replaceVideo',
              message: `Cette vidéo est déjà présente dans la liste. Voulez-vous la remplacer ?`,
              onConfirm: () => {
                setConfirmState({ type: null, message: '', onConfirm: () => {} })
                // Retirer l'ancienne vidéo et continuer
                setVideos((prev) => prev.filter((v) => v.videoId !== metadata.videoId))
                loadVideoInternal(url)
              },
            })
            return
          }

          const singleVideo: VideoWithAnswer = {
            videoId: metadata.videoId,
            videoUrl: url,
            title: metadata.title,
            thumbnailUrl: metadata.thumbnailUrl,
            answer: metadata.title,
            selected: true,
            hint: undefined,
          }

          setVideos([singleVideo])
          setVideoUrl('') // Réinitialiser l'URL après chargement
          setEditingIndex(null) // Réinitialiser l'édition
          toast.success('Vidéo chargée')
        }
      } catch (error) {
        console.error('Error loading video:', error)
        toast.error(error instanceof Error ? error.message : 'Erreur lors du chargement')
      } finally {
        setLoading(false)
      }
    },
    [videos]
  )

  // Charger automatiquement quand une URL YouTube valide est collée
  useEffect(() => {
    const trimmedUrl = videoUrl.trim()
    if (trimmedUrl && isYouTubeUrl(trimmedUrl) && !loading) {
      const timer = setTimeout(() => {
        loadVideo(trimmedUrl)
      }, 800) // 800ms debounce

      return () => clearTimeout(timer)
    }
  }, [videoUrl, loadVideo, loading])

  const handleLoadVideo = async () => {
    if (!videoUrl.trim()) {
      toast.error('Veuillez entrer une URL YouTube')
      return
    }

    if (!isYouTubeUrl(videoUrl)) {
      toast.error('URL YouTube invalide')
      return
    }

    await loadVideo(videoUrl.trim())
  }

  const handleToggleVideo = (index: number) => {
    setVideos((prev) =>
      prev.map((video, i) => (i === index ? { ...video, selected: !video.selected } : video))
    )
  }

  const handleSelectAll = () => {
    setVideos((prev) => prev.map((video) => ({ ...video, selected: true })))
    toast.success('Toutes les vidéos sélectionnées')
  }

  const handleDeselectAll = () => {
    setVideos((prev) => prev.map((video) => ({ ...video, selected: false })))
    toast.success('Toutes les vidéos désélectionnées')
  }

  const handleEditAnswer = (index: number, answer: string, hint?: string) => {
    setVideos((prev) => prev.map((video, i) => (i === index ? { ...video, answer, hint } : video)))
    setEditingIndex(null)
  }

  const handleRemoveVideo = (index: number) => {
    const video = videos[index]
    setConfirmState({
      type: 'remove',
      message: `Êtes-vous sûr de vouloir retirer "${video.title}" de la liste ?`,
      onConfirm: () => {
        setConfirmState({ type: null, message: '', onConfirm: () => {} })
        setVideos((prev) => prev.filter((_, i) => i !== index))
        if (editingIndex === index) {
          setEditingIndex(null)
        } else if (editingIndex !== null && editingIndex > index) {
          setEditingIndex(editingIndex - 1)
        }
        toast.success('Vidéo retirée')
      },
    })
  }

  const handleImport = async () => {
    if (selectedCategories.length === 0) {
      toast.error('Veuillez sélectionner au moins une catégorie')
      return
    }

    const videosToImport = selectedVideos

    if (videosToImport.length === 0) {
      toast.error('Veuillez sélectionner au moins une vidéo avec une réponse')
      return
    }

    // Avertir si certaines vidéos sélectionnées n'ont pas de réponse
    if (videosWithoutAnswer > 0) {
      const confirmMessage = `${videosWithoutAnswer} vidéo(s) sélectionnée(s) n'ont pas de réponse et ne seront pas importées. Continuer l'import de ${videosToImport.length} vidéo(s) ?`
      setConfirmState({
        type: 'import',
        message: confirmMessage,
        onConfirm: () => {
          setConfirmState({ type: null, message: '', onConfirm: () => {} })
          performImport(videosToImport)
        },
      })
      return
    }

    performImport(videosToImport)
  }

  const performImport = async (videosToImport: VideoWithAnswer[]) => {
    setIsImporting(true)
    setImportProgress({ current: 0, total: videosToImport.length })

    try {
      const newQuestions: Question[] = []

      for (let i = 0; i < videosToImport.length; i++) {
        const video = videosToImport[i]
        setImportProgress({ current: i + 1, total: videosToImport.length })

        try {
          const questionId = await QuestionService.generateId(video.videoUrl, selectedCategories[0])
          const newQuestion: Question = {
            id: questionId,
            category: selectedCategories.length === 1 ? selectedCategories[0] : selectedCategories,
            type: 'video' as const,
            mediaUrl: video.videoUrl,
            answer: video.answer,
            hint: video.hint,
          }
          await QuestionService.addQuestion(newQuestion)
          newQuestions.push(newQuestion)
        } catch (error) {
          console.error(`Error importing video ${video.title}:`, error)
          toast.error(`Erreur lors de l'import de "${video.title}"`)
        }
      }

      toast.success(`${newQuestions.length} question(s) importée(s)`)
      navigate('/editor', { state: { imported: newQuestions.length } })
    } catch (error) {
      console.error('Error importing videos:', error)
      const errorMessage =
        error instanceof Error
          ? error.message.includes('Failed to fetch')
            ? 'Erreur de connexion au serveur. Vérifiez votre connexion internet.'
            : error.message
          : "Erreur inconnue lors de l'import"
      toast.error(errorMessage)
    } finally {
      setIsImporting(false)
      setImportProgress({ current: 0, total: 0 })
    }
  }

  const handleCancel = () => {
    navigate('/editor')
  }

  const handleClearVideos = () => {
    if (videos.length > 0) {
      setConfirmState({
        type: 'clear',
        message: 'Êtes-vous sûr de vouloir effacer toutes les vidéos chargées ?',
        onConfirm: () => {
          setConfirmState({ type: null, message: '', onConfirm: () => {} })
          setVideos([])
          setVideoUrl('')
          setEditingIndex(null)
          setSelectedCategories([])
          toast.success('Liste effacée')
        },
      })
    }
  }

  const toggleCategory = (category: Category) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    )
  }

  // Optimisations avec useMemo
  const selectedVideosCount = useMemo(() => videos.filter((v) => v.selected).length, [videos])

  const selectedVideos = useMemo(
    () => videos.filter((v) => v.selected && v.answer.trim()),
    [videos]
  )

  const allSelected = useMemo(() => videos.length > 0 && videos.every((v) => v.selected), [videos])

  const noneSelected = useMemo(
    () => videos.length > 0 && videos.every((v) => !v.selected),
    [videos]
  )

  const videosWithoutAnswer = useMemo(
    () => videos.filter((v) => v.selected && !v.answer.trim()).length,
    [videos]
  )

  return (
    <div className="video-import-page">
      <header className="video-import-header">
        <button className="back-button" onClick={handleCancel} title="Retour à l'éditeur">
          <span style={{ marginRight: '0.5rem', fontSize: '16px' }}>◀️</span> Retour
        </button>
        <h1>Importer une vidéo YouTube</h1>
      </header>

      <div className="video-import-content">
        <div className="playlist-input-section">
          <div className="input-section-header">
            <label htmlFor="youtube-url-input">URL YouTube :</label>
            {videos.length > 0 && (
              <button
                className="clear-button"
                onClick={handleClearVideos}
                title="Effacer toutes les vidéos chargées"
                aria-label="Effacer toutes les vidéos"
              >
                <span style={{ marginRight: '0.5rem', fontSize: '16px' }}>🗑️</span> Effacer
              </button>
            )}
          </div>
          <div className="input-wrapper">
            <input
              id="youtube-url-input"
              type="text"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !loading && videoUrl.trim()) {
                  e.preventDefault()
                  handleLoadVideo()
                }
              }}
              placeholder="https://www.youtube.com/watch?v=... ou https://www.youtube.com/playlist?list=..."
              disabled={loading}
              aria-label="URL YouTube"
            />
          </div>
          <button
            className="load-button"
            onClick={handleLoadVideo}
            disabled={loading || !videoUrl.trim()}
            aria-label="Charger la vidéo ou playlist"
          >
            {loading ? (
              <span className="spinner" style={{ fontSize: '16px' }}>
                ⏳
              </span>
            ) : (
              <span style={{ fontSize: '16px' }}>➕</span>
            )}
            {loading ? 'Chargement...' : 'Charger'}
          </button>
        </div>

        {videos.length > 0 && (
          <>
            <div className="categories-selection">
              <label>Catégories :</label>
              <div className="categories-checkboxes">
                {categories.map((cat) => (
                  <label key={cat.id} className="category-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(cat.id)}
                      onChange={() => toggleCategory(cat.id)}
                    />
                    <span>{cat.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="videos-list">
              <div className="videos-list-header">
                <h3>
                  {isPlaylist
                    ? `Vidéos (${selectedVideosCount}/${videos.length} sélectionnées${videosWithoutAnswer > 0 ? `, ${videosWithoutAnswer} sans réponse` : ''})`
                    : 'Vidéo à importer'}
                </h3>
                {isPlaylist && videos.length > 0 && (
                  <div className="select-all-buttons">
                    {!allSelected && (
                      <button
                        className="select-all-button"
                        onClick={handleSelectAll}
                        title="Sélectionner toutes les vidéos"
                        aria-label="Sélectionner toutes les vidéos"
                      >
                        Tout sélectionner
                      </button>
                    )}
                    {!noneSelected && (
                      <button
                        className="deselect-all-button"
                        onClick={handleDeselectAll}
                        title="Désélectionner toutes les vidéos"
                        aria-label="Désélectionner toutes les vidéos"
                      >
                        Tout désélectionner
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className={`videos-grid ${!isPlaylist ? 'single-video' : ''}`}>
                {videos.map((video, index) => (
                  <div
                    key={video.videoId}
                    className={`video-item ${!video.selected ? 'unselected' : ''}`}
                  >
                    {isPlaylist && (
                      <div className="video-header">
                        <label className="video-checkbox">
                          <input
                            type="checkbox"
                            checked={video.selected}
                            onChange={() => handleToggleVideo(index)}
                          />
                        </label>
                        <img
                          src={video.thumbnailUrl}
                          alt={video.title}
                          className="video-thumbnail"
                        />
                      </div>
                    )}

                    {!isPlaylist && (
                      <div className="video-header-single">
                        <img
                          src={video.thumbnailUrl}
                          alt={video.title}
                          className="video-thumbnail"
                        />
                      </div>
                    )}

                    <div className="video-info">
                      {isPlaylist && (
                        <button
                          className="remove-video-button"
                          onClick={() => handleRemoveVideo(index)}
                          title="Retirer cette vidéo"
                        >
                          <span style={{ fontSize: '16px' }}>🗑️</span>
                        </button>
                      )}

                      <div className="video-title-wrapper">
                        <div className="video-title" title={video.title}>
                          {video.title}
                        </div>
                        <a
                          href={video.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="video-external-link"
                          title="Ouvrir sur YouTube"
                          aria-label="Ouvrir la vidéo sur YouTube"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span style={{ fontSize: '16px' }}>🔗</span>
                        </a>
                      </div>

                      {!video.answer.trim() && video.selected && (
                        <div
                          className="video-warning"
                          title="Cette vidéo n'a pas de réponse et ne sera pas importée"
                        >
                          <span style={{ marginRight: '0.5rem', fontSize: '16px' }}>⚠️</span> Aucune
                          réponse
                        </div>
                      )}

                      {editingIndex === index ? (
                        <div className="video-edit-form">
                          <input
                            type="text"
                            value={video.answer}
                            onChange={(e) => {
                              const newVideos = [...videos]
                              newVideos[index].answer = e.target.value
                              setVideos(newVideos)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                handleEditAnswer(index, video.answer, video.hint)
                              } else if (e.key === 'Escape') {
                                e.preventDefault()
                                setEditingIndex(null)
                              }
                            }}
                            placeholder="Réponse"
                            autoFocus
                            aria-label="Réponse"
                          />
                          <input
                            type="text"
                            value={video.hint || ''}
                            onChange={(e) => {
                              const newVideos = [...videos]
                              newVideos[index].hint = e.target.value || undefined
                              setVideos(newVideos)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                handleEditAnswer(index, video.answer, video.hint)
                              } else if (e.key === 'Escape') {
                                e.preventDefault()
                                setEditingIndex(null)
                              }
                            }}
                            placeholder="Indice (optionnel)"
                            aria-label="Indice (optionnel)"
                          />
                          <div className="edit-actions">
                            <button
                              className="save-edit-button"
                              onClick={() => handleEditAnswer(index, video.answer, video.hint)}
                              title="Valider (Entrée)"
                              aria-label="Valider"
                            >
                              <span style={{ fontSize: '16px' }}>✅</span>
                            </button>
                            <button
                              className="cancel-edit-button"
                              onClick={() => setEditingIndex(null)}
                              title="Annuler (Échap)"
                              aria-label="Annuler"
                            >
                              <span style={{ fontSize: '16px' }}>✕</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="video-answer">
                          <div className="answer-text">
                            <strong>Réponse :</strong> {video.answer || <em>Aucune réponse</em>}
                          </div>
                          {video.hint && (
                            <div className="hint-text">
                              <strong>Indice :</strong> {video.hint}
                            </div>
                          )}
                          <button
                            className="edit-answer-button"
                            onClick={() => setEditingIndex(index)}
                            title="Modifier la réponse"
                          >
                            <span style={{ marginRight: '0.5rem', fontSize: '16px' }}>✏️</span>{' '}
                            Modifier
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="video-import-footer">
              {isImporting && (
                <div className="import-progress">
                  <span className="spinner" style={{ fontSize: '16px' }}>
                    ⏳
                  </span>
                  <span>
                    Importation en cours... {importProgress.current}/{importProgress.total}
                  </span>
                </div>
              )}
              <button className="cancel-button" onClick={handleCancel} disabled={isImporting}>
                Annuler
              </button>
              <button
                className="import-button"
                onClick={handleImport}
                disabled={
                  isImporting || selectedCategories.length === 0 || selectedVideos.length === 0
                }
                aria-label={`Importer ${selectedVideos.length} vidéo(s)`}
              >
                {isImporting ? (
                  <>
                    <span className="spinner" style={{ fontSize: '16px' }}>
                      ⏳
                    </span>
                    Importation...
                  </>
                ) : (
                  `Importer ${selectedVideos.length} vidéo(s)`
                )}
              </button>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmState.type !== null}
        title={
          confirmState.type === 'clear'
            ? 'Effacer les vidéos'
            : confirmState.type === 'remove'
              ? 'Retirer la vidéo'
              : confirmState.type === 'import'
                ? "Confirmer l'import"
                : confirmState.type === 'replace' || confirmState.type === 'replaceVideo'
                  ? 'Remplacer les vidéos'
                  : 'Confirmation'
        }
        message={confirmState.message}
        confirmText="Confirmer"
        cancelText="Annuler"
        variant={
          confirmState.type === 'clear' || confirmState.type === 'remove' ? 'warning' : 'info'
        }
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState({ type: null, message: '', onConfirm: () => {} })}
      />
    </div>
  )
}
