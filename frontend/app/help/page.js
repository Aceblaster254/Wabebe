import Link from 'next/link';
import PageShell from '@/components/PageShell';

const FAQ = [
  {
    q: 'How do I book a seat?',
    a: 'Pick a route from the home page, choose a trip, pick where you want to board, then select an empty seat. Enter your name and phone number. That\'s it! You\'ll get a boarding pass with a QR code to show the conductor when you board.'
  },
  {
    q: 'What if my stop isn\'t on the list?',
    a: 'Every route stop-picker has a "Pin on map" button. Drop a pin at your actual boarding spot and give it a name. The conductor will see exactly where to pick you up. Popular custom stops start showing up automatically for future riders on the same route.'
  },
  {
    q: 'Is Wabebe free?',
    a: 'The service is free during the v1.0 launch. The fare will match what you\'d pay any matatu on that route for typical trips. No hidden Wabebe fees on top.'
  },
  {
    q: 'Can I cancel a booking?',
    a: 'Yes. Open your boarding pass and tap "Cancel booking." Because there\'s no payment yet, there\'s nothing to refund — you just free up the seat for someone else. Cancelling within 10 minutes of departure counts as a soft strike, so avoid doing it if you can.'
  },
  {
   q: 'What happens if I don\'t show up?',
    a: (
      <>
        <p style={{margin: '0 0 12px'}}>
          The conductor waits <strong>5 minutes at the origin stop</strong> and <strong>2 minutes at intermediate stops</strong> before marking you as a no-show. Timing starts when the bus arrives.
        </p>
        <p style={{margin: '0 0 12px'}}>
          The consequence depends on your history:
        </p>
        <ul style={{margin: '0 0 12px', paddingLeft: 20}}>
          <li><strong>1st no-show</strong> — 1-day booking ban</li>
          <li><strong>2nd no-show</strong> — 3-day ban</li>
          <li><strong>3rd and beyond</strong> — 7-day ban</li>
        </ul>
        <p style={{margin: '0 0 12px'}}>
          If the conductor forces an early departure before the wait window ends, your no-show is marked <em>disputable</em> — you won't be automatically banned, and dispatch will review the case. Reach out via WhatsApp if that happens.
        </p>
        <p style={{margin: 0}}>
          Treat your booking like a real appointment. Someone else could have used that seat.
        </p>
      </>
    )
  },
  {
    q: 'How do I track my bus?',
    a: 'Every boarding pass has a "Track my bus" button. It shows the bus\'s live position on a map, along with an estimated arrival time at your stop. Tracking updates every 15 seconds when the bus is moving.'
  },
  {
    q: 'How do I find my booking?',
    a: <>Go to <Link href="/my-bookings">My bookings</Link> and enter the phone number you booked with, plus your booking reference. You'll find the reference on the boarding pass — it's the 8-character code under the QR code.</>
  },
  {
    q: 'What\'s the difference between the seat map and the map map?',
    a: 'The seat map (the grid of buttons during booking) shows which seats are taken on the bus. The map (the geographic one) shows the location of the bus and stops in real time. Two different maps, both important.'
  },
  {
    q: 'Do I need an account?',
    a: (
      <>
        <p style={{margin: '0 0 12px'}}>
          Not right now — you can book with just your name and phone. But an account will genuinely make your life easier when accounts land in the next version. Here's what signing up will unlock:
        </p>
        <ul style={{margin: '0 0 12px', paddingLeft: 20}}>
          <li><strong>Never lose a booking again.</strong> See every trip you've ever taken, on any device, without needing to remember booking references.</li>
          <li><strong>One-tap booking.</strong> Your name and phone stay saved. Pick a seat, confirm, done.</li>
          <li><strong>Loyalty rewards.</strong> Earn points for every ride, redeem them for free trips.</li>
          <li><strong>Dispute protection.</strong> If a no-show or suspension feels wrong, a verified account makes appeals faster.</li>
          <li><strong>Priority for new features.</strong> Early access to new routes, off-peak deals, and things we haven't announced yet.</li>
        </ul>
        <p style={{margin: 0}}>
          We'll let you know when accounts open. It'll be free and take about 30 seconds.
        </p>
      </>
    )
  },
  {
    q: 'How long do my strikes last?',
    a: (
      <>
        <p style={{margin: '0 0 12px'}}>
          Right now, strikes accumulate on your record — a strike from six months ago still counts toward your total. The <em>ban duration</em> resets after you serve it (1 day, 3 days, or 7 days), but the strike itself stays on your record.
        </p>
        <p style={{margin: 0}}>
          We're planning a strike expiry system (strikes older than 90 days won't count) but it isn't live yet. If you feel your history is being counted unfairly, reach out to <Link href="/contact">dispatch</Link>.
        </p>
      </>
    )
  },
  {
    q: 'What if the bus doesn\'t come?',
    a: <>Rare, but it happens (mechanical issues, traffic emergencies). Contact <Link href="/contact">dispatch via WhatsApp</Link> with your booking reference — they will rebook you on the next bus.</>
  }
];

export default function HelpPage() {
  return (
    <PageShell
      eyebrow="Help & FAQ"
      title="How Wabebe works"
      subtitle="Answers to the questions we hear most often. Can't find yours? Reach out."
    >
      <div className="ps-faq">
        {FAQ.map((item, i) => (
          <div key={i} className="ps-faq-item">
            <div className="ps-faq-question">{item.q}</div>
            <div className="ps-faq-answer">{item.a}</div>
          </div>
        ))}
      </div>

      <div className="ps-box" style={{ marginTop: 40 }}>
        <div className="ps-box-title">Still stuck?</div>
        <p style={{ margin: 0 }}>
          If your question isn't here, <Link href="/contact">get in touch with dispatch</Link>.
          Real humans, real fast, no bots.
        </p>
      </div>
    </PageShell>
  );
}