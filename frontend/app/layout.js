import './globals.css';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Wabebe — Reserve your seat. Track your bus.',
  description: 'Book your seat on Nairobi\'s commuter buses. See exactly where your bus is. Board with confidence.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        {children}
        <Footer />
      </body>
    </html>
  );
}