import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './NavBar.css';

const NAV_LINKS = [
  { label: 'User Guide', path: '/guide' },
  { label: 'Pricing', path: '/pricing' },
  { label: 'FAQ', path: '/faq' },
];

export const NavBar = () => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (!isMenuOpen) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMenuOpen]);

  return (
    <header className="navbar">
      <button
        type="button"
        className="navbar__logo"
        onClick={() => navigate('/')}
      >
        ZONER
      </button>

      <button
        type="button"
        className="navbar__toggle"
        aria-expanded={isMenuOpen}
        aria-controls="navbar-menu"
        aria-label={isMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
        onClick={() => setIsMenuOpen((open) => !open)}
      >
        <span aria-hidden="true">{isMenuOpen ? '✕' : '☰'}</span>
      </button>

      <nav
        id="navbar-menu"
        className={`navbar__menu ${isMenuOpen ? 'navbar__menu--open' : ''}`}
        aria-label="주 메뉴"
      >
        {NAV_LINKS.map((link) => (
          <button
            key={link.path}
            type="button"
            className="navbar__link"
            onClick={() => {
              setIsMenuOpen(false);
              navigate(link.path);
            }}
          >
            {link.label}
          </button>
        ))}
      </nav>
    </header>
  );
};

export default NavBar;
