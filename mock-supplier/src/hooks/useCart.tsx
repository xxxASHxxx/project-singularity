'use client';
import React, { createContext, useContext, useState, useCallback } from 'react';

export interface CartItem {
  sku: string;
  name: string;
  price: number;
  quantity: number;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (sku: string, name: string, price: number, qty: number) => void;
  removeItem: (sku: string) => void;
  clearCart: () => void;
  itemCount: number;
  total: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((sku: string, name: string, price: number, qty: number) => {
    setItems(prev => {
      const existing = prev.find(i => i.sku === sku);
      if (existing) {
        return prev.map(i => i.sku === sku ? { ...i, quantity: i.quantity + qty } : i);
      }
      return [...prev, { sku, name, price, quantity: qty }];
    });
  }, []);

  const removeItem = useCallback((sku: string) => {
    setItems(prev => prev.filter(i => i.sku !== sku));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, clearCart, itemCount, total }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
