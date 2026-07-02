import Link from 'next/link';
import PageShell from '@/components/PageShell';

export default function AboutPage() {
  return (
    <PageShell
      eyebrow="About Wabebe"
      title="Reserved seats on Kenya's matatus"
      subtitle="We're bringing structure to the way Kenyans get to work — one reserved seat at a time."
    >
      <h2>Why we built this</h2>
      <p>
        Every morning, thousands of Nairobians wait at stages for matatus that come and go without warning.
        You don't know if the next one has space. If it's full, you wait for another. If you're running late, you have no way to hold a seat.
        Peak-hour commuting turns into a game of luck.
      </p>
      <p>
        Wabebe changes the arrangement. You book a specific seat on a specific bus, at a specific time.
        You track the bus on its way to your stop. You board with your seat guaranteed.
        The SACCO knows exactly who's coming. Everyone wins a little bit of order back.
      </p>

      <h2>How it works today</h2>
      <p>
        We're partnering with one SACCO on the pilot route network across Nairobi.
        Every trip is a real bus with a real driver and a real conductor.
        The technology just makes sure the right passengers meet the right buses at the right time.
      </p>

      <h2>What's next</h2>
      <p>
        We're expanding routes as we validate the pilot. M-Pesa payments are coming in v1.1.
        Loyalty rewards for regular riders will land alongside real accounts.
        The core promise won't change: <strong>reserve your seat, track your bus, board with confidence.</strong>
      </p>

      <div className="ps-box">
        <div className="ps-box-title">Made in Nairobi</div>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)' }}>
          Wabebe is a Kenyan project. Built here, tested here, for people who move here every day.
        </p>
      </div>

      <p style={{ marginTop: 30 }}>
        <Link href="/" className="ps-cta">Book a ride →</Link>
      </p>
    </PageShell>
  );
}