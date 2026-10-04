import { Cormorant_Garamond } from 'next/font/google';
import './gallery.css';

const museum = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-museum',
  display: 'swap',
});

// Runs before paint so the room never flashes the wrong lighting.
const themeScript = `(function(){var t;try{t=localStorage.getItem('gtheme')}catch(e){}if(t!=='dark'&&t!=='light'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.gtheme=t})()`;

export default function GalleryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`gallery ${museum.variable}`}>
      <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      {children}
    </div>
  );
}
