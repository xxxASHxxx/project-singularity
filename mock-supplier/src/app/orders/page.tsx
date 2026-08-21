import Link from 'next/link';

async function getOrders() {
  try {
    const { getDb } = await import('@/lib/db');
    const db = getDb();
    return db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all() as any[];
  } catch {
    return [];
  }
}

export default async function OrdersPage() {
  const orders = await getOrders();
  return (
    <>
      <h1 className="page-title">Order History</h1>
      {orders.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          <p>No orders yet. <a href="/catalog" style={{ color: '#f59e0b' }}>Start shopping</a></p>
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Order Ref</th>
                <th>SKU</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order: any) => (
                <tr key={order.id}>
                  <td className="order-ref">{order.order_ref}</td>
                  <td className="order-ref">{order.sku}</td>
                  <td>{order.product_name}</td>
                  <td>{order.quantity}</td>
                  <td>${order.total_price.toFixed(2)}</td>
                  <td><span className="status-confirmed">{order.status}</span></td>
                  <td style={{ fontSize: '0.8rem', color: '#6b7280' }}>{new Date(order.created_at).toLocaleString()}</td>
                  <td><Link href={`/orders/${order.order_ref}`} style={{ color: '#f59e0b', fontSize: '0.85rem' }}>View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
