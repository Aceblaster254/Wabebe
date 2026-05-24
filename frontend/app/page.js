import Hero from '@/components/Hero';
import BookingCard from '@/components/BookingCard';
import StatusStrip from '@/components/StatusStrip';
import PopularRoutes from '@/components/PopularRoutes';
import './home.css';

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <div className="hero-bg"></div>
        <div className="hero-inner">
          <Hero />
          <BookingCard />
        </div>
      </section>

      <StatusStrip />

      <PopularRoutes />
    </main>
  );
}