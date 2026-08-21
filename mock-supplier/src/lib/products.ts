export interface Product {
  sku: string;
  name: string;
  price: number;
  description: string;
  stock: number;
  category: string;
}

// Demo catalog — matches Spring Boot seed data
export const PRODUCTS: Product[] = [
  {
    sku: 'SKU-001',
    name: 'Premium Widget',
    price: 29.99,
    description: 'High-performance widget for professional use',
    stock: 500,
    category: 'Widgets',
  },
  {
    sku: 'SKU-002',
    name: 'Deluxe Gadget',
    price: 49.99,
    description: 'Feature-packed gadget with extended warranty',
    stock: 300,
    category: 'Gadgets',
  },
  {
    sku: 'SKU-003',
    name: 'Standard Component',
    price: 14.99,
    description: 'Reliable standard-grade component, bulk pricing available',
    stock: 1000,
    category: 'Components',
  },
  {
    sku: 'SKU-004',
    name: 'Bulk Material',
    price: 8.99,
    description: 'Industrial bulk material, priced per unit',
    stock: 5000,
    category: 'Materials',
  },
  {
    sku: 'SKU-005',
    name: 'Assembly Kit',
    price: 74.99,
    description: 'Complete assembly kit with all required parts',
    stock: 150,
    category: 'Kits',
  },
  {
    sku: 'SKU-006',
    name: 'Pro Connector',
    price: 19.99,
    description: 'Professional-grade connector, rated for heavy duty',
    stock: 800,
    category: 'Components',
  },
  {
    sku: 'SKU-007',
    name: 'Ultra Module',
    price: 99.99,
    description: 'Ultra high-spec module for enterprise systems',
    stock: 100,
    category: 'Modules',
  },
];
