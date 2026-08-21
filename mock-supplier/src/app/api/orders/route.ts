import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { PRODUCTS } from '@/lib/products';

function generateOrderRef(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `APX-${ts}-${rand}`;
}

export async function GET() {
  const db = getDb();
  const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  return NextResponse.json(orders);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { items } = body as { items: Array<{ sku: string; name: string; price: number; quantity: number }> };

  if (!items || items.length === 0) {
    return NextResponse.json({ error: 'No items in order' }, { status: 400 });
  }

  const db = getDb();
  const insertOrder = db.prepare(`
    INSERT INTO orders (order_ref, sku, product_name, quantity, unit_price, total_price)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const orderRef = generateOrderRef();
  const insertMany = db.transaction((items: any[]) => {
    for (const item of items) {
      const product = PRODUCTS.find(p => p.sku === item.sku);
      const unitPrice = product?.price ?? item.price;
      insertOrder.run(
        orderRef,
        item.sku,
        item.name,
        item.quantity,
        unitPrice,
        unitPrice * item.quantity
      );
    }
  });

  insertMany(items);

  return NextResponse.json({ orderRef, status: 'CONFIRMED' }, { status: 201 });
}
