import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { isYouTubePlaylistUrl, isYouTubeUrl, getPlaylistVideos, getYouTubeMetadata, type PlaylistVideo } from '../../utils/youtube'
import type { Category, CategoryInfo } from '../../types'
import '../../styles/index.css'

interface VideoWithAnswer {
  videoId: string
  videoUrl: string
  title: string
  thumbnailUrl: string
  answer: string
  hint?: string
  selected: boolean
}

interface VideoImporterProps {
  isOpen: boolean
  onClose: () => void
  onImport: (videos: Array<{ videoUrl: string; answer: string; hint?: string }>, categories: Category[]) => Promise<void>
  categories: CategoryInfo[]
}

export default function VideoImporter({ isOpen, onClose, onImport, categories }: VideoImporterProps) {
  const [videoUrl, setVideoUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [videos, setVideos] = useState<VideoWithAnswer[]>([])
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([])
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [isPlaylist, setIsPlaylist] = useState(false)

  // Fonction pour charger une vidéo/playlist
  const loadVideo = useCallback(async (url: string) => {
    if (!url.trim()) {
      return
    }

    if (!isYouTubeUrl(url)) {
      return
    }

    setLoading(true)
    try {
      const isPlaylistUrl = isYouTubePlaylistUrl(url)
      if (isPlaylistUrl) {
        // Mode playlist
        const playlistVideos = await getPlaylistVideos(url)
        
        const videosWithAnswers: VideoWithAnswer[] = playlistVideos.map(video => ({
          ...video,
          answer: video.title,
          selected: true,
          hint: undefined
        }))

        setVideos(videosWithAnswers)
        toast.success(`${playlistVideos.length} vidéo(s) chargée(s)`)
      } else {
        // Mode vidéo unique
        const metadata = await getYouTubeMetadata(url)
        if (!metadata) {
          toast.error('Impossible de récupérer les informations de la vidéo')
          return
        }

        const singleVideo: VideoWithAnswer = {
          videoId: metadata.videoId,
          videoUrl: url,
          title: metadata.title,
          thumbnailUrl: metadata.thumbnailUrl,
          answer: metadata.title,
          selected: true,
          hint: undefined
        }

        setVideos([singleVideo])
        toast.success('Vidéo chargée')
      }
    } catch (error) {
      console.error('Error loading video:', error)
      toast.error(error instanceof Error ? error.message : 'Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  // Détecter si c'est une playlist ou une vidéo unique
  useEffect(() => {
    if (videoUrl.trim()) {
      setIsPlaylist(isYouTubePlaylistUrl(videoUrl))
    } else {
      setIsPlaylist(false)
    }
  }, [videoUrl])

  // Charger automatiquement quand une URL YouTube valide est collée
  useEffect(() => {
    const trimmedUrl = videoUrl.trim()
    // Vérifier que c'est une URL YouTube valide, qu'on n'est pas déjà en train de charger, et qu'on n'a pas déjà de vidéos chargées
    if (trimmedUrl && isYouTubeUrl(trimmedUrl) && !loading && videos.length === 0) {
      // Délai pour éviter de charger à chaque caractère tapé (debounce)
      const timer = setTimeout(() => {
        loadVideo(trimmedUrl)
      }, 800) // 800ms de délai après la fin de la saisie
      
      return () => clearTimeout(timer)
    }
  }, [videoUrl, loading, videos.length, loadVideo])

  if (!isOpen) return null

  const handleLoadVideo = async () => {
    if (!videoUrl.trim()) {
      toast.error('Veuillez entrer une URL YouTube')
      return
    }

    if (!isYouTubeUrl(videoUrl)) {
      toast.error('URL YouTube invalide')
      return
    }

    const trimmedUrl = videoUrl.trim()
    if (!trimmedUrl) {
      toast.error('Veuillez entrer une URL YouTube')
      return
    }

    if (!isYouTubeUrl(trimmedUrl)) {
      toast.error('URL YouTube invalide')
      return
    }

    await loadVideo(trimmedUrl)
  }

  const handleToggleVideo = (index: number) => {
    setVideos(prev => prev.map((video, i) => 
      i === index ? { ...video, selected: !video.selected } : video
    ))
  }

  const handleEditAnswer = (index: number, answer: string, hint?: string) => {
    setVideos(prev => prev.map((video, i) => 
      i === index ? { ...video, answer, hint } : video
    ))
    setEditingIndex(null)
  }

  const handleRemoveVideo = (index: number) => {
    setVideos(prev => prev.filter((_, i) => i !== index))
    if (editingIndex === index) {
      setEditingIndex(null)
    } else if (editingIndex !== null && editingIndex > index) {
      setEditingIndex(editingIndex - 1)
    }
  }

  const handleImport = async () => {
    if (selectedCategories.length === 0) {
      toast.error('Veuillez sélectionner au moins une catégorie')
      return
    }

    const selectedVideos = videos.filter(v => v.selected && v.answer.trim())
    
    if (selectedVideos.length === 0) {
      toast.error('Veuillez sélectionner au moins une vidéo avec une réponse')
      return
    }

    try {
      await onImport(
        selectedVideos.map(v => ({
          videoUrl: v.videoUrl,
          answer: v.answer,
          hint: v.hint
        })),
        selectedCategories
      )
      toast.success(`${selectedVideos.length} vidéo(s) importée(s)`)
      handleClose()
    } catch (error) {
      console.error('Error importing videos:', error)
      toast.error('Erreur lors de l\'import')
    }
  }

  const handleClose = () => {
    setVideoUrl('')
    setVideos([])
    setSelectedCategories([])
    setEditingIndex(null)
    setIsPlaylist(false)
    onClose()
  }

  const toggleCategory = (category: Category) => {
    setSelectedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content playlist-importer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Importer {isPlaylist ? 'une playlist' : 'une vidéo'} YouTube</h2>
          <button className="close-button" onClick={handleClose} title="Fermer">
            <span style={{ fontSize: '16px' }}>✕</span>
          </button>
        </div>

        <div className="modal-body">
          <div className="playlist-input-section">
            <label>
              URL YouTube {isPlaylist ? '(playlist)' : '(vidéo)'} :
            </label>
            <div className="input-wrapper">
              <input
                type="text"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder={isPlaylist ? "https://www.youtube.com/playlist?list=..." : "https://www.youtube.com/watch?v=..."}
                disabled={loading}
              />
              {videoUrl.trim() && (
                <div className="video-type-indicator">
                  {isPlaylist ? (
                    <span className="type-badge playlist-badge">📋 Playlist</span>
                  ) : (
                    <span className="type-badge video-badge">🎬 Vidéo</span>
                  )}
                </div>
              )}
              <button 
                className="load-button"
                onClick={handleLoadVideo}
                disabled={loading || !videoUrl.trim()}
              >
                {loading ? <span className="spinner" style={{ fontSize: '16px' }}>⏳</span> : <span style={{ fontSize: '16px' }}>➕</span>}
                {loading ? 'Chargement...' : 'Charger'}
              </button>
            </div>
          </div>

          {videos.length > 0 && (
            <>
              <div className="categories-selection">
                <label>Catégories :</label>
                <div className="categories-checkboxes">
                  {categories.map(cat => (
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
                <h3>
                  {isPlaylist 
                    ? `Vidéos (${videos.filter(v => v.selected).length}/${videos.length} sélectionnées)`
                    : 'Vidéo à importer'
                  }
                </h3>
                <div className={`videos-grid ${!isPlaylist ? 'single-video' : ''}`}>
                  {videos.map((video, index) => (
                    <div key={video.videoId} className={`video-item ${!video.selected ? 'unselected' : ''}`}>
                      {isPlaylist && (
                        <div className="video-header">
                          <label className="video-checkbox">
                            <input
                              type="checkbox"
                              checked={video.selected}
                              onChange={() => handleToggleVideo(index)}
                            />
                          </label>
                          <img src={video.thumbnailUrl} alt={video.title} className="video-thumbnail" />
                        </div>
                      )}
                      
                      {!isPlaylist && (
                        <div className="video-header-single">
                          <img src={video.thumbnailUrl} alt={video.title} className="video-thumbnail" />
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
                        <div className="video-title" title={video.title}>
                          {video.title}
                        </div>
                        
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
                              placeholder="Réponse"
                              autoFocus
                            />
                            <input
                              type="text"
                              value={video.hint || ''}
                              onChange={(e) => {
                                const newVideos = [...videos]
                                newVideos[index].hint = e.target.value || undefined
                                setVideos(newVideos)
                              }}
                              placeholder="Indice (optionnel)"
                            />
                            <div className="edit-actions">
                              <button
                                className="save-edit-button"
                                onClick={() => handleEditAnswer(index, video.answer, video.hint)}
                                title="Valider"
                              >
                                <span style={{ fontSize: '16px' }}>✅</span>
                              </button>
                              <button
                                className="cancel-edit-button"
                                onClick={() => setEditingIndex(null)}
                                title="Annuler"
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
                              <span style={{ marginRight: '0.5rem', fontSize: '16px' }}>✏️</span> Modifier
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {videos.length > 0 && (
          <div className="modal-footer">
            <button className="cancel-button" onClick={handleClose}>
              Annuler
            </button>
            <button 
              className="import-button"
              onClick={handleImport}
              disabled={selectedCategories.length === 0 || videos.filter(v => v.selected && v.answer.trim()).length === 0}
            >
              Importer {videos.filter(v => v.selected).length} vidéo(s)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

