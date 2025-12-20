# Dossier des médias pour le blindtest

Placez vos fichiers multimédias dans ce dossier pour les utiliser dans le blindtest.

## Structure recommandée

```
public/media/
├── chansons/
│   ├── song1.mp3
│   ├── song2.mp3
│   └── ...
├── series/
│   ├── serie1.jpg
│   ├── serie2.jpg
│   └── ...
├── animes/
│   ├── anime1.jpg
│   ├── anime2.jpg
│   └── ...
├── films/
│   ├── film1.jpg
│   ├── film2.jpg
│   └── ...
└── jeux/
    ├── jeu1.jpg
    ├── jeu2.jpg
    └── ...
```

## Utilisation dans questions.json

Pour utiliser un fichier local, utilisez le chemin relatif depuis `public/` :

```json
{
  "id": "c1",
  "category": "chansons",
  "type": "audio",
  "mediaUrl": "/media/chansons/song1.mp3",
  "answer": "Nom de la chanson",
  "options": ["Option 1", "Option 2", "Option 3", "Option 4"]
}
```

## Formats supportés

- **Audio** : `.mp3`, `.wav`, `.ogg`
- **Images** : `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`
- **Vidéo** : `.mp4`, `.webm`, `.ogg`

## URLs externes

Vous pouvez aussi utiliser des URLs externes (YouTube, SoundCloud, etc.) :

```json
{
  "mediaUrl": "https://example.com/audio.mp3"
}
```


