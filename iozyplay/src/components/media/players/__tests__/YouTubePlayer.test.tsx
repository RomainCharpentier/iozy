/**
 * Tests du lecteur YouTube : point de départ, continuité au reveal, titre masqué
 * (l'API IFrame est remplacée par un faux lecteur)
 */
import { vi } from 'vitest'
import { render, act } from '@testing-library/react'
import { GENERIC_PLAYER_TITLE } from '@/utils/iframeTitle'

const VIDEO_TITLE = 'One Piece OP 1 - We Are! Lyrics'

type Events = {
  onReady?: (event: { target: FakePlayer }) => void
  onStateChange?: (event: { target: FakePlayer; data: number }) => void
}

class FakePlayer {
  static instances: FakePlayer[] = []
  state = 5 // CUED
  currentTime = 0
  iframe: HTMLIFrameElement
  options: { videoId: string; playerVars: Record<string, unknown>; events: Events }
  seekTo = vi.fn((seconds: number) => {
    this.currentTime = seconds
  })
  playVideo = vi.fn(() => this.setState(1))
  pauseVideo = vi.fn(() => this.setState(2))
  loadVideoById = vi.fn()
  cueVideoById = vi.fn()
  isMutedFlag = false
  mute = vi.fn(() => {
    this.isMutedFlag = true
  })
  unMute = vi.fn(() => {
    this.isMutedFlag = false
  })
  isMuted = () => this.isMutedFlag
  destroy = vi.fn()

  constructor(elementId: string, options: FakePlayer['options']) {
    this.options = options
    // Comme l'API : le placeholder est remplacé par une iframe titrée avec le titre de la vidéo
    this.iframe = document.createElement('iframe')
    this.iframe.setAttribute('title', VIDEO_TITLE)
    document.getElementById(elementId)?.replaceWith(this.iframe)
    FakePlayer.instances.push(this)
  }

  getPlayerState = () => this.state
  getCurrentTime = () => this.currentTime
  getIframe = () => this.iframe
  getVideoUrl = () => `https://www.youtube.com/watch?v=${this.options.videoId}`

  ready() {
    // L'API réécrit le titre au chargement
    this.iframe.setAttribute('title', VIDEO_TITLE)
    this.options.events.onReady?.({ target: this })
  }

  setState(state: number) {
    this.state = state
    this.options.events.onStateChange?.({ target: this, data: state })
  }
}

const fakeYT = { Player: FakePlayer }

vi.mock('@/hooks/useYouTubeAPI', () => ({
  useYouTubeAPI: () => ({ isReady: true, YT: fakeYT, error: null }),
}))

import YouTubePlayer from '@/components/media/players/YouTubePlayer'

const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

const URL = 'https://www.youtube.com/watch?v=abc123'

function setup(startSeconds = 30) {
  const onMediaReady = vi.fn()
  const onMediaStart = vi.fn()
  const baseProps = { mediaUrl: URL, startSeconds, onMediaReady, onMediaStart }
  const utils = render(
    <YouTubePlayer {...baseProps} autoPlay={false} shouldPause showVideo={false} />
  )
  const player = FakePlayer.instances[FakePlayer.instances.length - 1]
  act(() => player.ready())
  return { ...utils, player, baseProps, onMediaReady, onMediaStart }
}

beforeEach(() => {
  FakePlayer.instances = []
})

describe('YouTubePlayer - point de départ', () => {
  it('charge la vidéo au point de départ (playerVars.start)', () => {
    const { player } = setup(30)
    expect(player.options.playerVars.start).toBe(30)
  })

  it("n'ajoute pas de start pour un départ à 0", () => {
    const { player } = setup(0)
    expect(player.options.playerVars.start).toBeUndefined()
  })

  it('démarre au point de départ au game:go, une seule fois', () => {
    const { player, rerender, baseProps, onMediaStart } = setup(30)
    expect(player.playVideo).not.toHaveBeenCalled()

    // game:go : autoPlay et plus de pause
    rerender(<YouTubePlayer {...baseProps} autoPlay shouldPause={false} showVideo={false} />)
    expect(player.seekTo).toHaveBeenCalledWith(30, true)
    expect(player.playVideo).toHaveBeenCalledTimes(1)
    expect(onMediaStart).toHaveBeenCalledTimes(1)
  })
})

describe('YouTubePlayer - continuité au reveal', () => {
  it('la vidéo continue à la même position, sans recréer le lecteur ni seekTo', async () => {
    const { player, rerender, baseProps, onMediaStart } = setup(30)
    rerender(<YouTubePlayer {...baseProps} autoPlay shouldPause={false} showVideo={false} />)
    player.seekTo.mockClear()
    player.playVideo.mockClear()
    player.currentTime = 44 // 14 s de devinette après le départ à 30 s

    // Nouveau callback fourni seulement au reveal : il doit être appelé (pas de closure figée)
    const onRevealVideoStart = vi.fn()
    rerender(
      <YouTubePlayer
        {...baseProps}
        autoPlay
        shouldPause={false}
        showVideo
        onRevealVideoStart={onRevealVideoStart}
      />
    )
    // Laisser passer d'éventuels traitements différés (l'ancien code faisait seekTo(0) après 100 ms)
    await act(() => new Promise((resolve) => setTimeout(resolve, 150)))

    expect(FakePlayer.instances).toHaveLength(1)
    expect(player.destroy).not.toHaveBeenCalled()
    expect(player.loadVideoById).not.toHaveBeenCalled()
    expect(player.seekTo).not.toHaveBeenCalled()
    expect(player.playVideo).not.toHaveBeenCalled()
    expect(player.currentTime).toBe(44)
    expect(onRevealVideoStart).toHaveBeenCalledTimes(1)
    // Le chrono de devinette n'est pas relancé
    expect(onMediaStart).toHaveBeenCalledTimes(1)
  })

  it('reprend la lecture si la vidéo était en pause, à la position courante', () => {
    const { player, rerender, baseProps, onMediaStart } = setup(30)
    rerender(<YouTubePlayer {...baseProps} autoPlay shouldPause={false} showVideo={false} />)
    act(() => player.setState(2)) // PAUSED
    player.seekTo.mockClear()
    player.playVideo.mockClear()
    player.currentTime = 40

    const onRevealVideoStart = vi.fn()
    rerender(
      <YouTubePlayer
        {...baseProps}
        autoPlay
        shouldPause={false}
        showVideo
        onRevealVideoStart={onRevealVideoStart}
      />
    )

    expect(player.seekTo).not.toHaveBeenCalled()
    expect(player.playVideo).toHaveBeenCalledTimes(1)
    expect(player.currentTime).toBe(40)
    expect(onRevealVideoStart).toHaveBeenCalledTimes(1)
    expect(onMediaStart).toHaveBeenCalledTimes(1)
  })

  it('un premier démarrage pendant le reveal ne relance pas le chrono de devinette', () => {
    const { player, rerender, baseProps, onMediaStart } = setup(30)
    rerender(<YouTubePlayer {...baseProps} autoPlay shouldPause={false} showVideo />)
    expect(player.playVideo).toHaveBeenCalled()
    expect(onMediaStart).not.toHaveBeenCalled()
  })
})

describe('YouTubePlayer - titre de la vidéo masqué', () => {
  it("l'iframe porte un titre générique dès la création et après onReady", async () => {
    const { player, container } = setup(0)
    await flush()
    expect(player.iframe.getAttribute('title')).toBe(GENERIC_PLAYER_TITLE)
    expect(container.innerHTML).not.toContain(VIDEO_TITLE)
  })

  it("le titre générique est réappliqué quand l'API le réécrit", async () => {
    const { player, container } = setup(0)
    player.iframe.setAttribute('title', VIDEO_TITLE)
    await flush()
    expect(player.iframe.getAttribute('title')).toBe(GENERIC_PLAYER_TITLE)
    expect(container.innerHTML).not.toContain(VIDEO_TITLE)
  })

  it("le lecteur est masqué de l'arbre d'accessibilité pendant la devinette", () => {
    const { player, rerender, baseProps } = setup(0)
    expect(player.iframe.closest('[aria-hidden="true"]')).not.toBeNull()
    rerender(<YouTubePlayer {...baseProps} autoPlay shouldPause={false} showVideo />)
    expect(player.iframe.closest('[aria-hidden="true"]')).toBeNull()
  })
})

describe('YouTubePlayer - son coupé localement', () => {
  it('coupe puis rétablit le son sans toucher à la lecture', () => {
    const { player, rerender, baseProps } = setup(30)
    rerender(<YouTubePlayer {...baseProps} autoPlay shouldPause={false} showVideo={false} />)
    player.playVideo.mockClear()
    player.pauseVideo.mockClear()
    player.seekTo.mockClear()

    rerender(<YouTubePlayer {...baseProps} autoPlay shouldPause={false} showVideo={false} muted />)
    expect(player.mute).toHaveBeenCalledTimes(1)
    expect(player.isMuted()).toBe(true)

    rerender(
      <YouTubePlayer {...baseProps} autoPlay shouldPause={false} showVideo={false} muted={false} />
    )
    expect(player.unMute).toHaveBeenCalledTimes(1)
    expect(player.isMuted()).toBe(false)
    expect(player.playVideo).not.toHaveBeenCalled()
    expect(player.pauseVideo).not.toHaveBeenCalled()
    expect(player.seekTo).not.toHaveBeenCalled()
  })

  it('un lecteur créé alors que le son est coupé démarre muet', () => {
    const utils = render(
      <YouTubePlayer mediaUrl={URL} autoPlay={false} shouldPause showVideo={false} muted />
    )
    const player = FakePlayer.instances[FakePlayer.instances.length - 1]
    act(() => player.ready())
    expect(player.isMuted()).toBe(true)
    utils.unmount()
  })
})
