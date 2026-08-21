import type { Metadata } from 'next';
import './globals.css';
import { CartProvider } from '@/hooks/useCart';
import Nav from '@/components/Nav';

export const metadata: Metadata = {
  title: 'Apex Supply Co. — B2B Supplier Portal',
  description: 'Order management and product catalog for authorized buyers',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CartProvider>
          <Nav />
          <div className="container">
            {children}
          </div>
        </CartProvider>
      </body>
    </html>
  );
}
