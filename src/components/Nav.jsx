import { Link, useLocation } from 'react-router-dom'
import styles from './Nav.module.css'

export default function Nav() {
  const location = useLocation()

  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        <Link to="/integrations" className={styles.logo}>
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="16" fill="#7C3AED"/>
            <path d="M16 8 C16 8 10 13 10 18 C10 21.3 12.7 24 16 24 C19.3 24 22 21.3 22 18 C22 13 16 8 16 8Z" fill="white" opacity="0.9"/>
            <path d="M16 12 C16 12 12 15.5 12 18 C12 20.2 13.8 22 16 22 C18.2 22 20 20.2 20 18 C20 15.5 16 12 16 12Z" fill="#7C3AED"/>
          </svg>
          <span className={styles.logoText}>Lotus Health</span>
        </Link>

        <div className={styles.links}>
          <Link
            to="/integrations"
            className={`${styles.link} ${location.pathname === '/integrations' ? styles.active : ''}`}
          >
            Integrations
          </Link>
          <Link
            to="/chat"
            className={`${styles.link} ${location.pathname === '/chat' ? styles.active : ''}`}
          >
            Chat
          </Link>
        </div>

        <div className={styles.profile}>
          <div className={styles.avatar}>S</div>
          <span className={styles.name}>Shivesh</span>
        </div>
      </div>
    </nav>
  )
}
