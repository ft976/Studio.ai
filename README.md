# Video Sparkle ✨

An AI-powered vertical short video and episodic series generator with multi-language voice narration and dynamic captions. Turn a one-line idea into a polished 9:16 video complete with cinematic script, visual assets, natural voiceover narration, and auto-synchronized captions in viral styles.

---

## 🎨 Visual Identity & Key Highlights

- **Dynamic Cinematic Pipeline**: Orchestrates narrative pacing, audio generation, caption synchronization, and frame rendering directly in your browser.
- **Aesthetic Caption Styles**: Choose from several preconfigured subtitle animations to mimic viral TikTok, Reels, and YouTube Shorts aesthetics.
- **Multi-Language Narration**: Generate voiceovers in multiple language configurations with natural-sounding vocal synthesis.
- **Interactive Player**: Real-time 9:16 timeline, custom playback controllers, video tracking, and instant export.
- **Episodic Series Mode**: Expand a single concept into structured multi-part vertical narratives.

---

## 🚀 Key Features

- **Prompt-to-Video Engine**: Input an idea, select duration, voice language, and subtitle typography, and let the AI script and produce the video.
- **Audio Stitching & Synthesis**: Automatically synchronizes synthetic voice scripts with rich background pacing.
- **Aesthetic Subtitles**: Dynamic caption rendering designed for engagement on modern social streams.
- **Responsive Media Player**: Full-featured immersive player custom-tailored for 9:16 vertical shorts.
- **Offline History Tracker**: Persistently saves completed and generating videos using local caching so your work is never lost.

---

## 📂 Project Architecture

```txt
├── app/
│   ├── api/             # Server-side endpoints
│   ├── globals.css      # Styling definitions (Tailwind)
│   ├── layout.tsx       # App structure and viewport config
│   └── page.tsx         # Main interactive video creation dashboard
├── lib/
│   ├── pipeline/        # Core pipeline mechanics
│   │   ├── apiClient.ts      # Audio and script fetches
│   │   ├── audioConcat.ts    # Audio mixing and concatenation
│   │   ├── captionStyles.ts  # Stylesheet & subtitle formatting
│   │   ├── nativeAssemble.ts # Native audio-visual binding
│   │   ├── renderFrames.ts   # Canvas frame renderer
│   │   ├── runPipeline.ts    # Step-by-step video compilation
│   │   └── types.ts          # Pipeline types
│   ├── backend-ai.ts    # Gemini API wrapper for scripts and scene layouts
│   └── wav.ts           # Low-level wav header assembly
```

---

## 💻 Tech Stack

- **Framework**: Next.js 15+ (App Router, Server Components)
- **Styling**: Tailwind CSS & `lucide-react` icons
- **State & Sync**: `@tanstack/react-query` & standard React State
- **Animation**: `motion` (by Framer)
- **Routing**: `wouter` client-side router
- **Type Safety**: TypeScript & `zod` schema validation

---

## 🛠️ Setup & Local Development

### 1. Prerequisites
Ensure you have Node.js (v18+) and your preferred package manager (npm or bun) installed.

### 2. Configure Environment Variables
Create a `.env` file or export your system environments. Ensure your key is defined:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to preview the application.

### 5. Build for Production
```bash
npm run build
npm start
```

---

## 🛡️ License
Distributed under the MIT License. See `LICENSE` for more information.
