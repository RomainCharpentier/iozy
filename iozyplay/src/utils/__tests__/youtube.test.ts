/**
 * Tests unitaires pour les utilitaires YouTube
 */
import {
  isValidUrlFormat,
  isYouTubeUrl,
  extractYouTubeId,
  getYouTubeThumbnailUrl,
  getYouTubeThumbnailFromUrl,
  extractYouTubeStartTime,
} from '@/utils/youtube'

describe('YouTube utilities', () => {
  describe('isValidUrlFormat', () => {
    it('should validate correct URLs', () => {
      expect(isValidUrlFormat('https://example.com')).toBe(true)
      expect(isValidUrlFormat('http://example.com')).toBe(true)
      expect(isValidUrlFormat('example.com')).toBe(true)
    })

    it('should reject invalid URLs', () => {
      expect(isValidUrlFormat('not a url')).toBe(false)
      expect(isValidUrlFormat('')).toBe(false)
    })
  })

  describe('isYouTubeUrl', () => {
    it('should identify YouTube URLs', () => {
      expect(isYouTubeUrl('https://www.youtube.com/watch?v=abc123')).toBe(true)
      expect(isYouTubeUrl('https://youtu.be/abc123')).toBe(true)
      expect(isYouTubeUrl('youtube.com/watch?v=abc123')).toBe(true)
    })

    it('should reject non-YouTube URLs', () => {
      expect(isYouTubeUrl('https://example.com')).toBe(false)
      expect(isYouTubeUrl('not a url')).toBe(false)
    })
  })

  describe('extractYouTubeId', () => {
    it('should extract ID from various YouTube URL formats', () => {
      expect(extractYouTubeId('https://www.youtube.com/watch?v=abc123')).toBe('abc123')
      expect(extractYouTubeId('https://youtu.be/abc123')).toBe('abc123')
      expect(extractYouTubeId('https://www.youtube.com/embed/abc123')).toBe('abc123')
    })

    it('should return null for invalid URLs', () => {
      expect(extractYouTubeId('not a youtube url')).toBeNull()
      expect(extractYouTubeId('https://example.com')).toBeNull()
    })
  })

  describe('getYouTubeThumbnailUrl', () => {
    it('should generate correct thumbnail URL', () => {
      const videoId = 'abc123'
      const thumbnailUrl = getYouTubeThumbnailUrl(videoId)
      expect(thumbnailUrl).toBe(`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`)
    })
  })

  describe('getYouTubeThumbnailFromUrl', () => {
    it('should extract thumbnail from YouTube URL', () => {
      const url = 'https://www.youtube.com/watch?v=abc123'
      const thumbnailUrl = getYouTubeThumbnailFromUrl(url)
      expect(thumbnailUrl).toBe('https://img.youtube.com/vi/abc123/mqdefault.jpg')
    })

    it('should return null for invalid URLs', () => {
      expect(getYouTubeThumbnailFromUrl('not a url')).toBeNull()
    })
  })
})

describe('extractYouTubeStartTime', () => {
  it('lit t= en secondes', () => {
    expect(extractYouTubeStartTime('https://youtu.be/abc123?t=90')).toBe(90)
    expect(extractYouTubeStartTime('https://www.youtube.com/watch?v=abc123&t=42')).toBe(42)
    expect(extractYouTubeStartTime('https://www.youtube.com/watch?v=abc123&t=42s')).toBe(42)
  })

  it('lit t= au format XhYmZs', () => {
    expect(extractYouTubeStartTime('https://youtu.be/abc123?t=1m30s')).toBe(90)
    expect(extractYouTubeStartTime('https://youtu.be/abc123?t=1h2m3s')).toBe(3723)
    expect(extractYouTubeStartTime('https://youtu.be/abc123?t=2m')).toBe(120)
  })

  it('lit start= et le fragment #t=', () => {
    expect(extractYouTubeStartTime('https://www.youtube.com/embed/abc123?start=15')).toBe(15)
    expect(extractYouTubeStartTime('https://www.youtube.com/watch?v=abc123#t=33')).toBe(33)
  })

  it('accepte une URL sans protocole', () => {
    expect(extractYouTubeStartTime('youtu.be/abc123?t=12')).toBe(12)
  })

  it('retourne null si absent ou invalide', () => {
    expect(extractYouTubeStartTime('https://youtu.be/abc123')).toBeNull()
    expect(extractYouTubeStartTime('https://youtu.be/abc123?t=abc')).toBeNull()
    expect(extractYouTubeStartTime('https://youtu.be/abc123?t=-5')).toBeNull()
    expect(extractYouTubeStartTime('https://example.com/video?t=10')).toBeNull()
    expect(extractYouTubeStartTime('')).toBeNull()
  })

  it("n'altère pas l'extraction de l'ID", () => {
    expect(extractYouTubeId('https://youtu.be/abc123?t=90')).toBe('abc123')
    expect(extractYouTubeId('https://www.youtube.com/watch?v=abc123&t=42s')).toBe('abc123')
  })
})
