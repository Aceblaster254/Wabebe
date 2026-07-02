import './PageShell.css';

export default function PageShell({ eyebrow, title, subtitle, children }) {
  return (
    <main className="ps-page">
      <div className="ps-hero">
        <div className="ps-hero-inner">
          {eyebrow && <div className="ps-eyebrow">{eyebrow}</div>}
          <h1 className="ps-title">{title}</h1>
          {subtitle && <p className="ps-subtitle">{subtitle}</p>}
        </div>
      </div>

      <div className="ps-content">
        <div className="ps-content-inner">
          {children}
        </div>
      </div>
    </main>
  );
}