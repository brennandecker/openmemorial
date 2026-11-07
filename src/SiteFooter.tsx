import "./site-pages.css";

export default function SiteFooter() {
  return <footer className="memorial-footer">
    <p>Made with love using OpenMemorial</p>
    <nav aria-label="Site information"><a href="/privacy">Privacy Policy</a><a href="/terms">Terms of Use</a><a href="/login">Family sign in</a></nav>
  </footer>;
}
