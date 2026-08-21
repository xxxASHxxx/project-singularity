'use client';
import { useState } from 'react';
import { PRODUCTS } from '@/lib/products';
import { useCart } from '@/hooks/useCart';

export default function CatalogPage() {
  const { addItem } = useCart();
  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries(PRODUCTS.map(p => [p.sku, 1]))
  );
  const [added, setAdded] = useState<Record<string, boolean>>({});

  const handleAdd = (sku: string, name: string, price: number) => {
    addItem(sku, name, price, quantities[sku] || 1);
    setAdded(prev => ({ ...prev, [sku]: true }));
    setTimeout(() => setAdded(prev => ({ ...prev, [sku]: false })), 1500);
  };

  return (
    <>
      <h1 className="page-title">Product Catalog</h1>
      <div className="product-grid">
        {PRODUCTS.map(product => (
          <div key={product.sku} className="product-card">
            <span className="product-sku">{product.sku} · {product.category}</span>
            <span className="product-name">{product.name}</span>
            <span className="product-price">${product.price.toFixed(2)}</span>
            <p className="product-desc">{product.description}</p>
            <p style={{ fontSize: '0.8rem', color: '#6b7280' }}>In stock: {product.stock.toLocaleString()}</p>
            <div className="qty-input">
              <label style={{ fontSize: '0.85rem' }}>Qty:</label>
              <input
                id={`qty-${product.sku}`}
                type="number"
                min="1"
                value={quantities[product.sku]}
                onChange={e => setQuantities(prev => ({ ...prev, [product.sku]: parseInt(e.target.value) || 1 }))}
              />
              <button
                id={`add-${product.sku}`}
                className="btn btn-primary"
                onClick={() => handleAdd(product.sku, product.name, product.price)}
              >
                {added[product.sku] ? '✓ Added' : 'Add to Cart'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
