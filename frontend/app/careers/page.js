import Link from 'next/link';
import PageShell from '@/components/PageShell';

export default function CareersPage() {
  return (
    <PageShell
      eyebrow="Careers"
      title="Work with us"
      subtitle="A small team building infrastructure for how Nairobi moves."
    >
      <h2>Where we are right now</h2>
      <p>
        Wabebe is in pilot phase. We're a small team focused on getting the fundamentals right on one route network before we scale.
        <strong> We're not actively hiring.</strong>
      </p>

      <h2>When we do hire</h2>
      <p>
        The roles we'll open first, in rough order:
      </p>
      <ul>
        <li><strong>Operations lead</strong> — someone who understands matatu operations, SACCOs, and the daily reality of Nairobi transit.</li>
        <li><strong>Field engineer</strong> — mobile-first Android and web, with an eye for user experience on low-end devices.</li>
        <li><strong>Growth &amp; partnerships</strong> — building relationships with SACCOs, county authorities, and payment providers.</li>
      </ul>

      <h2>Interested regardless?</h2>
      <p>
        If you're the kind of person who reads a "we're not hiring" page and still wants to reach out —
        that's exactly the kind of person we want to hear from. Send us a note via{' '}
        <Link href="/contact">Contact</Link> with what you'd want to work on and why.
        We keep a shortlist and reach out when roles open.
      </p>
    </PageShell>
  );
}