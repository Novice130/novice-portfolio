import { Cormorant_Garamond } from 'next/font/google';
import './gallery.css';
import './gallery3d.css';

const museum = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-museum',
  display: 'swap',
});

// Runs before paint so the room never flashes the wrong lighting.
const themeScript = `(function(){var t;try{t=localStorage.getItem('gtheme')}catch(e){}if(t!=='dark'&&t!=='light'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.gtheme=t})()`;

// Same idea for the walk: pick 3D or the flat catalogue before first paint.
// Without JS neither attribute is set and the catalogue shows. If the bundle
// never hydrates, the watchdog drops back to the catalogue instead of leaving
// the curtain up.
const modeScript = `(function(){var d=document.documentElement,m;try{m=localStorage.getItem('gmode')}catch(e){}if(!window.WebGL2RenderingContext){d.dataset.g3='none';m='flat'}d.dataset.gmode=m==='flat'?'flat':'3d';setTimeout(function(){if(d.dataset.gmode==='3d'&&!d.dataset.g3)d.dataset.gmode='flat'},10000)})()`;

export default function GalleryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`gallery ${museum.variable}`}>
      <script dangerouslySetInnerHTML={{ __html: `${themeScript};${modeScript}` }} />
      {children}
    </div>
  );
}
