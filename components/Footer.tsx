import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-cols">
          <div>
            <Link href="/" className="nav-brand" style={{ marginBottom: 12 }}>
              <Image src="/logo-sketch-nav.png" alt="Novice tree mark" width={28} height={28} style={{ objectFit: 'contain' }} />
              Novice
            </Link>
            <p className="small muted" style={{ marginTop: 12 }}>
              The engineering team your school doesn&rsquo;t have to hire.
            </p>
          </div>

          <nav aria-label="Footer">
            <h4>Pages</h4>
            <ul>
              <li><Link href="/schools">For Schools</Link></li>
              <li><Link href="/work">Work</Link></li>
              <li><Link href="/about">About</Link></li>
              <li><Link href="/trust">Trust</Link></li>
              <li><Link href="/contact">Contact</Link></li>
            </ul>
          </nav>

          <div>
            <h4>Elsewhere</h4>
            <ul>
              <li><a href="https://github.com/Novice130" target="_blank" rel="noopener">GitHub</a></li>
              <li><a href="https://www.youtube.com/@learnnovice" target="_blank" rel="noopener">YouTube</a></li>
              <li><a href="mailto:syedamer@learnnovice.com">Email</a></li>
            </ul>
          </div>

          <div>
            <h4>Entity</h4>
            <p className="small muted">
              Novice Digital Solutions
              <br />
              Wyoming, USA
              <br />
              Engineering in Hyderabad, India
            </p>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Novice Digital Solutions</span>
          <span>Built in Hyderabad.</span>
        </div>
      </div>
    </footer>
  );
}
