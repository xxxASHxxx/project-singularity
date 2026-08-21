import { notFound } from 'next/navigation';

async function getOrder(ref: string) {
  try {
    const { getDb } = await import('@/lib/db');
    const db = getDb();
    return db.prepare('SELECT * FROM orders WHERE order_ref = ?').get(ref) as any;
  } catch {
    return null;
  }
}

export default async function OrderConfirmationPage({ params }: { params: { ref: string } }) {
  const order = await getOrder(params.ref);
  if (!order) notFound();

  return (
    <>
      <div className="success-box" style={{ maxWidth: 600, margin: '2rem auto' }}>
        <div style={{ fontSize: '4rem', marginBottom: '0.5rem' }}>✅</div>
        <h1>Order Confirmed!</h1>
        <p style={{ color: '#166534', marginBottom: '1rem' }}>Your purchase order has been received and confirmed.</p>
        <div className="order-id" id="order-ref-display">Order Ref: {order.order_ref}</div>
        <table style={{ margin: '1.5rem auto', width: '100%', textAlign: 'left' }}>
          <tbody>
            <tr><td style={{ padding: '0.3rem 1rem', color: '#6b7280' }}>SKU</td><td style={{ fontFamily: 'monospace' }}>{order.sku}</td></tr>
            <tr><td style={{ padding: '0.3rem 1rem', color: '#6b7280' }}>Product</td><td>{order.product_name}</td></tr>
            <tr><td style={{ padding: '0.3rem 1rem', color: '#6b7280' }}>Quantity</td><td>{order.quantity} units</td></tr>
            <tr><td style={{ padding: '0.3rem 1rem', color: '#6b7280' }}>Unit Price</td><td>${order.unit_price.toFixed(2)}</td></tr>
            <tr><td style={{ padding: '0.3rem 1rem', color: '#6b7280' }}>Total</td><td><strong>${order.total_price.toFixed(2)}</strong></td></tr>
            <tr><td style={{ padding: '0.3rem 1rem', color: '#6b7280' }}>Status</td><td className="status-confirmed">{order.status}</td></tr>
          </tbody>
        </table>
        <a href="/orders" style={{ color: '#f59e0b', textDecoration: 'underline' }}>View all orders</a>
      </div>
    </>
  );
}
