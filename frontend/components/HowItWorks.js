import './HowItWorks.css';

export default function HowItWorks() {
  return (
    <section className="block" id="how">
      <div className="section-head">
        <div className="section-head-left">
          <div className="section-eyebrow">How it works</div>
          <h2 className="section-title">
            From stop to seat in <em>three steps.</em>
          </h2>
        </div>
      </div>

      <div className="how-grid">
        <div className="how-step">
          <div className="how-num">01</div>
          <h3 className="how-title">Pick your route and time</h3>
          <p className="how-text">
            Choose your stop and the bus that fits your schedule. See live seat availability before you commit.
          </p>
        </div>

        <div className="how-step">
          <div className="how-num">02</div>
          <h3 className="how-title">Reserve the seat you want</h3>
          <p className="how-text">
            Tap the exact seat on a real bus layout — window, aisle, back row. It's yours for the trip.
          </p>
        </div>

        <div className="how-step">
          <div className="how-num">03</div>
          <h3 className="how-title">Track and board</h3>
          <p className="how-text">
            Follow your bus on the map in real time. Arrive when it does. Show your boarding pass and you're on.
          </p>
        </div>
      </div>
    </section>
  );
}