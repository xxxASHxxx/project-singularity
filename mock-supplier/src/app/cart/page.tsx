'use client';
import { useCart } from '@/hooks/useCart';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function CartPage() {
  const { items, removeItem, clearCart, total } = useCart();
  const router = useRouter();
  const [placing, setPlacing] = useState(false);

  const placeOrder = async () => {
    if (items.length === 0) return;
    setPlacing(true);
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await response.json();
      clearCart();
      router.push(`/orders/${data.orderRef}`);
    } catch (err) {
      alert('Order failed: ' + err);
      setPlacing(false);
    }
  };

  if (items.length === 0) {
    return (
      <>
        <h1 className="page-title">Your Cart</h1>
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          <p style={{ fontSize: '1.2rem' }}>🛒 Your cart is empty.</p>
          <a href="/catalog" style={{ color: '#f59e0b', textDecoration: 'underline', marginTop: '1rem', display: 'block' }}>Browse catalog</a>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="page-title">Your Cart</h1>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product</th>
              <th>Unit Price</th>
              <th>Qty</th>
              <th>Line Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.sku}>
                <td className="order-ref">{item.sku}</td>
                <td>{item.name}</td>
                <td>${item.price.toFixed(2)}</td>
                <td>{item.quantity}</td>
                <td><strong>${(item.price * item.quantity).toFixed(2)}</strong></td>
                <td>
                  <button id={`remove-${item.sku}`} className="btn btn-danger" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => removeItem(item.sku)}>Remove</button>
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={4} style={{ textAlign: 'right', fontWeight: 700 }}>Total:</td>
              <td colSpan={2}><strong style={{ fontSize: '1.1rem' }}>${total.toFixed(2)}</strong></td>
            </tr>
          </tbody>
        </table>
        <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
          <button id="place-order-btn" className="btn btn-success" onClick={placeOrder} disabled={placing}>
            {placing ? 'Placing Order...' : '📦 Place Order'}
          </button>
        </div>
      </div>
    </>
  );
}
