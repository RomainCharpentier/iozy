# 🎵 Blindtest WebApp

A modern web application for blindtest games where you can guess TV series, anime, songs, movies, and video games!

## 🚀 Features

- **Real blindtest** : Listen to audio clips or watch images/videos to guess
- **Multiple categories** : TV Series, Anime, Songs, Movies, Video Games
- **Integrated media player** : Play/pause controls for audio and video
- **Custom selection** : Choose the categories you want to play
- **Score system** : Track your progress in real-time
- **Modern interface** : Clean and responsive design
- **Immediate feedback** : See the correct answer after each question
- **Multiplayer mode** : Play online with friends in real-time rooms
- **Solo mode** : Play alone at your own pace
- **YouTube support** : Use YouTube videos as media sources

## 📦 Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser at the indicated address (usually `http://localhost:5173`)

## 🌐 Multiplayer Mode

To run the multiplayer mode, you need to start both the frontend and backend:

```bash
npm run dev:all
```

This starts both the backend server (port 3001) and the frontend Vite server (port 5173).

### Separate terminals

**Terminal 1 - Backend:**
```bash
npm run dev:server
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

## 🏗️ Production Build

```bash
npm run build
```

Files will be generated in the `dist/` folder.

## 📁 Project Structure

```
blindtest-webapp/
├── src/
│   ├── components/       # React components
│   │   ├── game/         # Game components
│   │   ├── room/         # Multiplayer room components
│   │   ├── media/        # Media player components
│   │   └── ...
│   ├── domain/           # Business logic (Clean Architecture)
│   ├── services/         # Service layer
│   ├── infrastructure/   # External implementations
│   ├── types.ts          # TypeScript types
│   ├── App.tsx           # Main component
│   └── main.tsx          # Entry point
├── server/               # Backend server
│   ├── domain/           # Server-side business logic
│   ├── handlers/         # Socket.io event handlers
│   └── config/           # Server configuration
├── public/
│   └── media/            # Media files directory
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 🎮 How to Play

1. Select one or more categories
2. Click "Start Game"
3. **Listen to the audio** or **watch the image/video** to guess
4. Use controls to play/pause media
5. Type your answer or select from options
6. View your score at the end of the game
7. Play again or return to the main menu

### Multiplayer Mode

1. Select "🌐 Online" mode
2. Create a room or join with a room code
3. Wait for all players to be ready
4. The host starts the game
5. All players see the same questions simultaneously
6. Compete for the highest score!

## ➕ Adding Questions and Media

### Adding Media

1. **Place your media files** in the `public/media/` folder:
   - For songs: audio files (`.mp3`, `.wav`, etc.)
   - For series/anime/movies/games: images (`.jpg`, `.png`, etc.) or videos (`.mp4`, etc.)

2. **Edit the file** `src/data/questions.json` to add your questions:

```json
{
  "id": "unique-id",
  "category": "songs",
  "type": "audio",
  "mediaUrl": "/media/songs/my-file.mp3",
  "answer": "Song Name",
  "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
  "hint": "Optional hint"
}
```

### Supported Media Types

- **`audio`** : For songs (`.mp3`, `.wav`, `.ogg` files)
- **`image`** : For series, anime, movies, games (`.jpg`, `.png`, `.gif`, `.webp` files)
- **`video`** : For video clips (`.mp4`, `.webm`, `.ogg` files)

### External URLs

You can also use external URLs:

```json
{
  "mediaUrl": "https://example.com/my-audio.mp3"
}
```

### YouTube Support

The application supports YouTube videos! You can use a YouTube URL and toggle between video and audio-only modes:

```json
{
  "id": "c7",
  "category": "songs",
  "type": "video",
  "mediaUrl": "https://www.youtube.com/watch?v=VIDEO_ID",
  "answer": "Song Name",
  "options": ["Option 1", "Option 2", "Option 3", "Option 4"]
}
```

**YouTube Features**:
- ✅ Play with video or audio-only
- ✅ Toggle button between modes
- ✅ Play/pause controls
- ✅ Support for YouTube URLs (youtube.com/watch, youtu.be, etc.)

To use audio-only mode, click the "👁️ Video" button to hide the video and keep only the sound.

### Recommended Structure

```
public/media/
├── songs/
│   └── your-songs.mp3
├── series/
│   └── your-images.jpg
├── anime/
│   └── your-images.jpg
├── movies/
│   └── your-images.jpg
└── games/
    └── your-images.jpg
```

## 🛠️ Technologies Used

- **React 18** - UI library
- **TypeScript** - Static typing
- **Vite** - Build tool and dev server
- **Socket.io** - Real-time multiplayer communication
- **Node.js** - Backend server
- **CSS3** - Modern styles with CSS variables

## 🏗️ Architecture

The project follows Clean Architecture principles:

- **Domain** : Pure business logic, no external dependencies
- **Services** : Facades for domain usage
- **Infrastructure** : Concrete implementations (localStorage, Socket.io, etc.)
- **Components** : React presentation layer

See `src/ARCHITECTURE.md` and `server/ARCHITECTURE.md` for more details.

## 📝 License

This project is free to use for personal and educational purposes.
