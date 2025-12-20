import { useEffect } from 'react'
import { soundManager } from '../utils/sounds'

interface TimeUpModalProps {
  isOpen: boolean
  answer: string
  onClose: () => void
}

export default function TimeUpModal({ isOpen, answer, onClose }: TimeUpModalProps) {
  useEffect(() => {
    if (isOpen) {
      // Empêcher le scroll du body quand le modal est ouvert
      document.body.style.overflow = 'hidden'
      // Son de fin de partie
      soundManager.playStart()
    } else {
      document.body.style.overflow = 'unset'
    }
    
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🎉 Partie terminée !</h2>
        </div>
        <div className="modal-body">
          <p className="modal-answer-label">{answer}</p>
        </div>
        <div className="modal-footer">
          <button 
            className="modal-button" 
            onClick={() => {
              soundManager.playClick()
              onClose()
            }}
          >
            Continuer
          </button>
        </div>
      </div>
    </div>
  )
}

