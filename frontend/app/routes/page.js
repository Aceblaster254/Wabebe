import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import PageShell from '@/components/PageShell';
import './routes.css';

export const revalidate = 300;

async function getRoutes() {
  const { data, error } = await supabase
    .from('routes')
    .select(`
      id, code, name, description, frequency_label,
      origin:origin_stop_id(name),
      destination:destination_stop_id(name)
    `)
    .eq('active', true)
    .order('code');

  if (error) return [];
  return data || [];
}

export default async function AllRoutesPage() {
  const routes = await getRoutes();

  return (
    <PageShell
      eyebrow="Routes"
      title="Every Wabebe route"
      subtitle="All Nairobi commuter routes running today. Tap any route to see live trips and book a seat."
    >
      {routes.length === 0 ? (
        <p><em>No active routes right now. Check back soon.</em></p>
      ) : (
        <div className="ar-list">
          {routes.map(r => (
            <Link href={`/routes/${r.code}`} key={r.id} className="ar-card">
              <div className="ar-card-head">
                <div className="ar-code">Route {r.code}</div>
                <div className="ar-freq">{r.frequency_label}</div>
              </div>
              <div className="ar-name">{r.name}</div>
              {r.description && <div className="ar-desc">{r.description}</div>}
              <div className="ar-endpoints">
                {r.origin?.name} <span className="ar-arrow">→</span> {r.destination?.name}
              </div>
            </Link>
          ))}
        </div>
      )}

      <div style={{ marginTop: 40 }}>
        <p>
          Missing a route you use? <Link href="/contact">Let us know</Link> — we're adding new lines every month.
        </p>
      </div>
    </PageShell>
  );
}