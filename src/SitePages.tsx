import { useEffect } from "react";
import { initialMemorial } from "./memorial";
import { headerPhotograph } from "./photoWallData";
import { policyUpdated, privacyEmail } from "./sitePolicy";
import SiteFooter from "./SiteFooter";

const Contact = () => <a href={`mailto:${privacyEmail}`}>{privacyEmail}</a>;
export default function SitePages({ page }: { page: "privacy" | "terms" | "login" }) {
  const title = page === "privacy" ? "Privacy Policy" : page === "terms" ? "Terms of Use" : "Family sign in";
  useEffect(() => {
    const previous = document.title; document.title = `${title} · ${initialMemorial.name}`;
    return () => { document.title = previous; };
  }, [title]);
  return <main className={`site-page${page === "login" ? " family-login" : ""}`}>
    <a className="page-back" href="/">← Back to the wall</a>
    {page === "login" ? <section className="login-paper">
      {headerPhotograph && <img className="login-portrait" src={headerPhotograph.src} alt={headerPhotograph.title} />}
      <p className="page-memorial-name">{initialMemorial.name}</p><h1>{title}</h1>
      <p>A private space for the family to review the memories shared on the wall.</p>
      <a className="family-login-button" href="/family">Continue with email</a>
      <p className="login-detail">Use an invited family email. Cloudflare will send you a one-time sign-in code.</p>
      <p className="login-detail">You don’t need to sign in to view the wall or share a memory.</p>
    </section> : <article className="policy-paper">
      <p className="page-memorial-name">{initialMemorial.name}</p><h1>{title}</h1>
      <p className="policy-updated">Last updated {policyUpdated}</p>
      {page === "privacy" ? <>
        <p>This memorial is cared for by {initialMemorial.name}’s family. This policy explains how we handle information when you visit, share a memory, or contact us. For questions or removal requests, email <Contact />.</p>
        <h2>What we collect</h2>
        <p>When you share a memory, we store the name you enter, your message, its submission date and time, and its review status. A visitor account or email address is not required. Please leave out addresses, phone numbers, medical details, and other sensitive information about yourself or others.</p>
        <p>For family reviewers, we process the authorized sign-in email and record who approved, declined, hid, or republished each memory, with the time and status change. If you contact us, we receive your email address, message, and any information you choose to include.</p>
        <h2>What becomes public</h2>
        <p>Submissions are private until a family reviewer approves them. If approved, your message, the name you entered, and its posting date appear publicly on the wall. Public content can be copied, shared, or indexed by search engines. Reviewers’ sign-in emails and the decision history are not published. Declined and hidden memories do not appear on the public wall.</p>
        <h2>How we use and share information</h2>
        <p>We use information to maintain this memorial, review submissions, prevent abuse, preserve a record of family decisions, and respond to requests. We do not sell personal information or use submissions for advertising. Authorized family reviewers and site administrators can access private submissions and review records.</p>
        <p>Cloudflare provides hosting, database storage, security, Turnstile bot checks, family sign-in, and email forwarding. These services process normal connection and security information, which can include IP addresses, browser information, request times, and verification signals. The memorial’s submission database does not store visitor IP addresses. Privacy emails are forwarded to the family’s mailbox provider. Service providers may process information in the United States and other countries.</p>
        <h2>Cookies and browser storage</h2>
        <p>Cloudflare may use necessary security or sign-in cookies. We have not added advertising trackers or an application analytics service. Turnstile runs when you open the memory form. The optional drafting studio saves its drafts in your browser’s local storage; clearing that storage removes those drafts.</p>
        <p>Read <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">Cloudflare’s Privacy Policy</a> and <a href="https://www.cloudflare.com/turnstile-privacy-policy/" target="_blank" rel="noopener noreferrer">Turnstile Privacy Addendum</a> for details about their services.</p>
        <h2>How long we keep information</h2>
        <p>Approved memories are kept as part of the memorial unless removed. Pending memories are kept while the family reviews them. Declined memories stay private and are normally kept for at least 60 days after the decision so accidental declines can be reversed. Hidden memories and review records are retained privately for moderation and recovery. There is currently no automatic deletion; the family can arrange removal when information is no longer needed. A verified privacy removal request may be handled sooner.</p>
        <p>Technical and security logs follow the service providers’ retention settings. Removing something from the wall cannot remove copies another person or search engine has already made.</p>
        <h2>Your choices and requests</h2>
        <p>You may browse without posting. To request access to, correction of, or removal of information about you, contact <Contact /> with enough detail to identify the item. We may ask for limited information to confirm the request relates to you. Depending on where you live, you may have additional privacy rights. We will consider requests under applicable law.</p>
        <h2>Children and safety</h2>
        <p>The memorial is open to visitors, but the submission form is intended for people aged 13 and older. A parent or guardian should contact us about information submitted by a child under 13. Do not post private information about children or other people without appropriate permission.</p>
        <h2>Security and policy updates</h2>
        <p>We use encrypted connections, restricted family access, bot checks, and approval before publication. No online service can guarantee complete security. We will post policy changes here and update the date above.</p>
      </> : <>
        <p>This is a personal memorial cared for by {initialMemorial.name}’s family. Please use it with kindness and respect for the people whose lives and memories are shared here.</p>
        <h2>Sharing a memory</h2>
        <p>By sending a memory, you confirm that you are at least 13, that you have permission to share it, and that it does not violate another person’s privacy or rights. Share your own words and use a name you are comfortable making public. Do not impersonate someone else.</p>
        <p>Do not submit harassment, threats, hateful content, spam, advertising, unlawful material, sensitive personal information, or content you do not have the right to share. Do not attempt to bypass moderation, sign-in controls, or security checks.</p>
        <h2>Family approval</h2>
        <p>Every visitor submission requires family approval before it appears publicly. The family may decline or hide a memory, including after publication, and is not required to publish a submission. Declined memories remain private and recoverable for at least 60 days in the normal review process. There is currently no automatic deletion. The family keeps a private record of moderation decisions.</p>
        <h2>Your words and permission to display them</h2>
        <p>You retain any rights you have in your submission. You give the family permission to store, review, and, if approved, display it as part of this memorial and its normal sharing features. This permission is non-exclusive and royalty-free. You can request removal by emailing <Contact />. Public copies made by others may remain outside our control.</p>
        <h2>Photographs and other content</h2>
        <p>Photographs, videos, and personal tributes belong to their respective owners. Please ask permission before reusing them. Any open-source license for the website’s code does not grant rights to its family photographs or memorial content.</p>
        <h2>Availability and responsibility</h2>
        <p>We try to keep the memorial accurate and available, but memories are personal accounts and may contain mistakes. Features and availability may change. Please contact us about errors, privacy concerns, or content you believe infringes your rights. These terms do not limit rights or protections that applicable law does not allow us to limit.</p>
        <h2>Privacy and changes</h2>
        <p>Our <a href="/privacy">Privacy Policy</a> explains how information is handled. We may update these terms by posting a revised version and changing the date above. Questions can be sent to <Contact />.</p>
      </>}
    </article>}
    <SiteFooter />
  </main>;
}
