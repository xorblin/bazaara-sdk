# @bazaara/sdk

The official type-safe, lightweight Headless Storefront SDK for the **Bazaara E-Commerce Platform**. 

Wrap your React, Next.js, Vue, Svelte, or Vanilla JS applications to communicate seamlessly with the Bazaara storefront APIs, complete with automatic guest sessions, token persistence, and full TypeScript typings.

---

## Features

- **Decoupled Headless Commerce**: Query catalog, cart, checkout, reviews, and customer accounts.
- **Dual Build Exports**: Targets both ESM (`.mjs`) and CommonJS (`.js`) environments out-of-the-box.
- **Auto Session Handling**: Capture and rotate guest tokens (`X-Guest-Token`) to persist cart state automatically.
- **SSR & Next.js Friendly**: Pluggable storage drivers (defaults to `localStorage`, falls back to in-memory, supports custom cookie/cache overrides).
- **Type Safe**: Auto-complete and strict interfaces matching the Bazaara database schemas.

---

## Installation

Install using your preferred package manager:

```bash
# Using bun
bun add @bazaara/sdk

# Using npm
npm install @bazaara/sdk

# Using pnpm
pnpm add @bazaara/sdk
```

---

## Quick Start

Initialize the `BazaaraStorefront` client with your Store ID:

```typescript
import { BazaaraStorefront } from '@bazaara/sdk';

const bazaara = new BazaaraStorefront({
  storeId: 'your-store-uuid-here',
  // Optional: defaults to 'https://api.bazaara.store/api/v1'
  baseUrl: 'http://localhost:3000/api/v1', 
});
```

---

## Code Examples

### 1. Browse the Catalog

```typescript
// Fetch store details
const { data: store } = await bazaara.catalog.getDetails();
console.log(`Welcome to ${store.name}!`);

// List products with pagination and filters
const { data: products } = await bazaara.catalog.getProducts({
  page: 1,
  limit: 10,
  category: 'Apparel',
  minPrice: 10,
  maxPrice: 100,
  sort: 'price_asc'
});

// Get a single product details
const { data: product } = await bazaara.catalog.getProduct('product-uuid');
```

### 2. Manage the Shopping Cart
Cart sessions (for both guest and logged-in customers) are handled automatically by the SDK.

```typescript
// Get current cart details
const { data: cart } = await bazaara.cart.get();

// Add product to cart with quantities and custom variant specifications
const { data: updatedCart } = await bazaara.cart.addItem('product-uuid', 2, {
  color: 'Blue',
  size: 'L'
});

// Update item quantities inside the cart
await bazaara.cart.updateItem('cart-item-uuid', 5);

// Remove item from cart
await bazaara.cart.removeItem('cart-item-uuid');

// Clear the cart
await bazaara.cart.clear();
```

### 3. Customer Authentication & Profiles

```typescript
// Sign up a new customer
const { data: signUpData } = await bazaara.auth.signup({
  name: 'John Doe',
  email: 'john@example.com',
  password: 'securepassword123'
});
// Note: accessToken is automatically stored and managed in the client

// Login an existing customer
const { data: loginData } = await bazaara.auth.login({
  email: 'john@example.com',
  password: 'securepassword123'
});

// Fetch authenticated profile details
const { data: customer } = await bazaara.auth.getProfile();
console.log(`Logged in as: ${customer.name}`);

// Logout (clears tokens from storage)
bazaara.auth.logout();
```

### 4. Process Checkout

```typescript
const order = await bazaara.checkout.process({
  email: 'john@example.com',
  phone: '123-456-7890',
  shippingAddress: {
    firstName: 'John',
    lastName: 'Doe',
    addressLine1: '123 E-Commerce Way',
    city: 'San Francisco',
    state: 'CA',
    zipCode: '94105',
    country: 'US',
    phone: '123-456-7890'
  },
  paymentMethod: 'stripe',
  paymentId: 'pm_mock_123', // from payment processor UI flow
  couponCode: 'SUMMER20'
});

console.log(`Order placed successfully! Order Number: ${order.data.orderNumber}`);
```

---

## Advanced Usage

### 🚀 Pluggable Storage (Next.js SSR, React Native)
By default, the SDK uses `window.localStorage` in the browser, falling back to a memory buffer on server targets. If you need to persist tokens across cookies or database caches (for SSR/Next.js routes or React Native's AsyncStorage), inject a custom synchronous storage object:

```typescript
import { BazaaraStorefront, BazaaraStorage } from '@bazaara/sdk';

const cookieStorage: BazaaraStorage = {
  getItem: (key) => {
    // Custom cookie parsing logic
    return getCookie(key);
  },
  setItem: (key, value) => {
    // Custom cookie writing logic
    setCookie(key, value, { expires: 7 });
  },
  removeItem: (key) => {
    // Custom cookie deletion logic
    deleteCookie(key);
  }
};

const bazaara = new BazaaraStorefront({
  storeId: 'your-store-id',
  storage: cookieStorage
});
```

### ⚠️ Structured Error Handling
All network and API validation errors are caught and thrown as a `BazaaraError`. You can inspect validation fields easily:

```typescript
import { BazaaraError } from '@bazaara/sdk';

try {
  await bazaara.auth.login({
    email: 'invalid-email',
    password: 'short'
  });
} catch (error) {
  if (BazaaraError.isBazaaraError(error)) {
    console.error(`HTTP Status: ${error.status}`);
    console.error(`Message: ${error.message}`);
    
    // Key/value mapping of fields containing validation arrays
    if (error.errors) {
      console.log('Validation Errors:', error.errors);
      // e.g. { email: ['Email is invalid.'], password: ['Password must be at least 6 characters.'] }
    }
  } else {
    console.error('Generic Error:', error);
  }
}
```

---

## Developer Guide

If you are contributing to `@bazaara/sdk`, use the following commands:

```bash
# Install dependencies
bun install

# Run tests
bun test

# Build package
bun run build
```

---

## License

ISC License. Copyright (c) Bazaara E-Commerce.
