import React from 'react'
import { useEffect, useRef } from 'react';
import "./mdemo.css"

function MDemo() {
      const innerRef = useRef(null);

  useEffect(() => {
    const onScroll = () => {
      if (!innerRef.current) return;
      if (window.scrollY > 30) innerRef.current.classList.add('scrolled');
      else innerRef.current.classList.remove('scrolled');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id) => (e) => {
    e.preventDefault();
    const el = document.querySelector(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

//   ----------------------------------------

  return (
    <>
     <div className="nav">
      <div className="nav-inner" ref={innerRef}>
        <a className="brand" href="#" aria-label="HumanCare Connect">
          <div className="brand-mark">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 4C10 4 8 5.5 8 8v1H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-2V8c0-2.5-2-4-4-4z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              <path d="M12 13v4M10 15h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="brand-name">HumanCare</span>
        </a>
        <nav className="nav-links">
          <a href="#doctors" onClick={scrollTo('#doctors')}>Find a Doctor</a>
          <a href="#how" onClick={scrollTo('#how')}>Ask a Question</a>
          <a href="#platform" onClick={scrollTo('#platform')}>Medical Services</a>
          <a href="#plans" onClick={scrollTo('#plans')}>Corporates</a>
          <a href="#stories" onClick={scrollTo('#stories')}>Blogs</a>
        </nav>
        <div className="nav-cta">
          <a href="#" className="auth-combined">
            <span>Login</span><span className="divider">/</span><span>Register</span>
          </a>
        </div>
      </div>
    </div>
    {/* ------------------------------ */}

    
    
    </>
  )
}

export default MDemo