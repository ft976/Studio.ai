import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Video Sparkle - AI Vertical Video Generator',
  description: 'An AI-powered vertical short video and episodic series generator with multi-language voice narration and dynamic captions.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
