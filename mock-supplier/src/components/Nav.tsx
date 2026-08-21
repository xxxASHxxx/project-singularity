'use client';
import Link from 'next/link';
import { useCart } from '@/hooks/useCart';

export default function Nav() {
  const { itemCount } = useCart();
  return (
    <nav>
      <span className="logo">🏪 Apex Supply Co.</span>
      <Link href="/catalog">Catalog</Link>
      <Link href="/cart">Cart {itemCount > 0 && <span className="badge">{itemCount}</span>}</Link>
      <Link href="/orders">Orders</Link>
    </nav>
  );
}
