import PageShell from '@/components/PageShell';

export default function ContactPage() {
  return (
    <PageShell
      eyebrow="Contact"
      title="Get in touch"
      subtitle="Real people ready to help — before your trip, during, or after."
    >
      <h2>Dispatch & support</h2>
      <p>
        For anything urgent — bus running late, seat concerns, boarding issues — reach out via WhatsApp.
        Our team monitors the line during operating hours (5:30 AM to 10:30 PM daily).
      </p>

      <div className="ps-box">
        <div className="ps-box-title">WhatsApp support</div>
        <p style={{ margin: 0 }}>
          Tap <a href="https://wa.me/254700000000">this link to open a chat</a>, or save the number as a contact.
          Include your booking reference and a short description of what's happening.
        </p>
      </div>

      <h2>For SACCOs & operators</h2>
      <p>
        Are you a SACCO chair or operator interested in bringing Wabebe to your routes?
        We'd love to talk. Reach out via WhatsApp with your SACCO name and current route network,
        and we'll set up a call.
      </p>

      <h2>Feedback & ideas</h2>
      <p>
        Wabebe is early. If you've used it and have thoughts — what worked, what didn't, what should be different —
        we genuinely want to hear from you. WhatsApp works, or email us at{' '}
        <a href="mailto:hello@wabebe.co.ke">hello@wabebe.co.ke</a> if you prefer.
      </p>

      <p><em>Email inbox is monitored weekdays. WhatsApp is faster for anything time-sensitive.</em></p>
    </PageShell>
  );
}