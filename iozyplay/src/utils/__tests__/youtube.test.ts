/**
 * Tests unitaires pour les utilitaires YouTube
 */
import { 
  isValidUrlFormat, 
  isYouTubeUrl, 
  extractYouTubeId, 
  getYouTubeThumbnailUrl,
  getYouTubeThumbnailFromUrl
} from '../youtube'

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












