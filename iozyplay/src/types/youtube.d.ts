// Types pour l'API YouTube IFrame Player
declare namespace YT {
  interface PlayerOptions {
    height?: string | number
    width?: string | number
    videoId?: string
    playerVars?: PlayerVars
    events?: Events
  }

  interface PlayerVars {
    autoplay?: 0 | 1
    cc_load_policy?: 0 | 1
    color?: 'red' | 'white'
    controls?: 0 | 1 | 2
    disablekb?: 0 | 1
    enablejsapi?: 0 | 1
    end?: number
    fs?: 0 | 1
    hl?: string
    iv_load_policy?: 1 | 3
    list?: string
    listType?: 'playlist' | 'search' | 'user_uploads'
    loop?: 0 | 1
    modestbranding?: 0 | 1
    origin?: string
    playlist?: string
    playsinline?: 0 | 1
    rel?: 0 | 1
    start?: number
    widget_referrer?: string
  }

  interface Events {
    onReady?: (event: PlayerEvent) => void
    onStateChange?: (event: OnStateChangeEvent) => void
    onPlaybackQualityChange?: (event: OnPlaybackQualityChangeEvent) => void
    onPlaybackRateChange?: (event: OnPlaybackRateChangeEvent) => void
    onError?: (event: OnErrorEvent) => void
    onApiChange?: (event: OnApiChangeEvent) => void
  }

  interface PlayerEvent {
    target: Player
  }

  interface OnStateChangeEvent extends PlayerEvent {
    data: number
  }

  interface OnPlaybackQualityChangeEvent extends PlayerEvent {
    data: string
  }

  interface OnPlaybackRateChangeEvent extends PlayerEvent {
    data: number
  }

  interface OnErrorEvent extends PlayerEvent {
    data: number
  }

  interface OnApiChangeEvent extends PlayerEvent {
    data: any
  }

  class Player {
    constructor(elementId: string, options: PlayerOptions)
    destroy(): void
    setSize(width: number, height: number): void
    playVideo(): void
    pauseVideo(): void
    stopVideo(): void
    seekTo(seconds: number, allowSeekAhead?: boolean): void
    clearVideo(): void
    loadVideoById(videoId: string, startSeconds?: number): void
    cueVideoById(videoId: string, startSeconds?: number): void
    loadVideoByUrl(mediaUrl: string, startSeconds?: number): void
    cueVideoByUrl(mediaUrl: string, startSeconds?: number): void
    getVideoLoadedFraction(): number
    getPlayerState(): number
    getCurrentTime(): number
    getDuration(): number
    getVideoUrl(): string
    getVideoEmbedCode(): string
    getOptions(): any[]
    getOption(option: string): any
    setOption(module: string, option: string, value: any): void
    setOptions(options: any): void
    getVolume(): number
    setVolume(volume: number): void
    isMuted(): boolean
    mute(): void
    unMute(): void
    setPlaybackQuality(suggestedQuality: string): void
    getPlaybackQuality(): string
    getAvailableQualityLevels(): string[]
    setPlaybackRate(suggestedRate: number): void
    getPlaybackRate(): number
    getAvailablePlaybackRates(): number[]
    getPlaylist(): string[]
    getPlaylistIndex(): number
    setLoop(loopPlaylists: boolean): void
    setShuffle(shufflePlaylist: boolean): void
    getIframe(): HTMLIFrameElement
    addEventListener(event: string, listener: (event: any) => void): void
    removeEventListener(event: string, listener: (event: any) => void): void
  }

  enum PlayerState {
    UNSTARTED = -1,
    ENDED = 0,
    PLAYING = 1,
    PAUSED = 2,
    BUFFERING = 3,
    CUED = 5,
  }
}
