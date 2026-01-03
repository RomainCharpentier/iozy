/**
 * Gestionnaires d'API pour YouTube (playlists, etc.)
 */

/**
 * GET /api/youtube/playlist/:playlistId - Récupère les vidéos d'une playlist YouTube
 */
export async function getPlaylistVideos(req, res) {
  try {
    const { playlistId } = req.params;

    if (!playlistId) {
      return res.status(400).json({ error: 'ID de playlist requis' });
    }

    // Solution: scraper la page HTML de la playlist (fonctionne côté serveur, pas de CORS)
    // Note: Pour une production plus robuste, utiliser l'API YouTube Data API avec une clé API
    const playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
    
    try {
      const response = await fetch(playlistUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch playlist`);
      }

      const html = await response.text();
      
      // Extraire les IDs de vidéos depuis le HTML
      const videoIdRegex = /"videoId":"([^"]{11})"/g;
      const videoIds = [];
      let match;

      while ((match = videoIdRegex.exec(html)) !== null) {
        const videoId = match[1];
        if (!videoIds.includes(videoId) && videoId.length === 11) {
          videoIds.push(videoId);
        }
      }

      // Extraire les titres (approche simplifiée)
      const videoTitleRegex = /"title":{"runs":\[{"text":"([^"]+)"}/g;
      const videoTitles = [];
      while ((match = videoTitleRegex.exec(html)) !== null && videoTitles.length < videoIds.length) {
        videoTitles.push(match[1]);
      }

      // Créer la liste des vidéos (limité à 100 pour éviter les problèmes)
      const videos = videoIds.slice(0, 100).map((videoId, index) => ({
        videoId,
        title: videoTitles[index] || 'Sans titre'
      }));

      if (videos.length === 0) {
        return res.status(404).json({ error: 'Aucune vidéo trouvée dans la playlist. Assurez-vous que la playlist est publique.' });
      }

      res.json({ videos });
    } catch (error) {
      console.error('Error fetching playlist:', error);
      // Si le scraping échoue, suggérer d'utiliser l'API YouTube Data API
      res.status(500).json({
        error: 'Erreur lors de la récupération de la playlist',
        hint: 'Pour une solution plus robuste, utilisez l\'API YouTube Data API avec une clé API'
      });
    }
  } catch (error) {
    console.error('Error in getPlaylistVideos:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération de la playlist' });
  }
}

