import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { BazaaraStorefront } from '../src/client';
import { BazaaraError } from '../src/error';

describe('BazaaraStorefront SDK - Strict Testing', () => {
  const storeId = 'store-uuid-abc';
  const customBaseUrl = 'https://custom.bazaara.io/api/v1';

  let originalFetch: typeof fetch;
  let lastFetchUrl: string | null = null;
  let lastFetchOptions: RequestInit | null = null;
  let lastFetchHeaders: Record<string, string> = {};
  let lastFetchBody: any = null;
  let mockResponse: Response | null = null;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    lastFetchUrl = null;
    lastFetchOptions = null;
    lastFetchHeaders = {};
    lastFetchBody = null;
    mockResponse = null;

    globalThis.fetch = (async (url: string | URL, options?: RequestInit) => {
      lastFetchUrl = String(url);
      lastFetchOptions = options || null;
      lastFetchHeaders = (options?.headers as Record<string, string>) || {};
      lastFetchBody = options?.body ? JSON.parse(String(options.body)) : null;

      if (mockResponse) return mockResponse.clone();
      
      return new Response(JSON.stringify({ success: true, data: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as any;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('Core Configuration & Storage Drivers', () => {
    test('Configures storeId, default baseUrl, and uses MemoryStorage fallback', () => {
      const client = new BazaaraStorefront({ storeId });
      expect(client).toBeDefined();
      expect(client.getAccessToken()).toBeNull();
      expect(client.getGuestToken()).toBeNull();
    });

    test('Throws validation error if storeId is omitted', () => {
      expect(() => new BazaaraStorefront({ storeId: '' })).toThrow('BazaaraStorefront requires a storeId.');
    });

    test('Custom Storage Driver interfaces work perfectly', async () => {
      const db: Record<string, string> = {};
      const storage = {
        getItem: (key: string) => db[key] || null,
        setItem: (key: string, value: string) => { db[key] = value; },
        removeItem: (key: string) => { delete db[key]; },
      };

      const client = new BazaaraStorefront({ storeId, storage });
      mockResponse = new Response(JSON.stringify({ success: true, data: { accessToken: 'jwt-123' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

      await client.auth.login({ email: 'x@x.com', password: '123' });
      expect(db[`bazaara_${storeId}_access_token`]).toBe('jwt-123');
      expect(client.getAccessToken()).toBe('jwt-123');

      client.auth.logout();
      expect(db[`bazaara_${storeId}_access_token`]).toBeUndefined();
      expect(client.getAccessToken()).toBeNull();
    });
  });

  describe('API Sub-Module: Auth (6 methods)', () => {
    let client: BazaaraStorefront;
    beforeEach(() => {
      client = new BazaaraStorefront({ storeId });
    });

    test('1. signup() triggers POST /auth/signup and caches token', async () => {
      mockResponse = new Response(JSON.stringify({ success: true, data: { accessToken: 'jwt-register' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      const payload = { name: 'John', email: 'john@x.com', password: 'pass' };
      const res = await client.auth.signup(payload);
      
      expect(lastFetchUrl).toBe(`https://api.bazaara.store/api/v1/stores/${storeId}/auth/signup`);
      expect(lastFetchOptions?.method).toBe('POST');
      expect(lastFetchBody).toEqual(payload);
      expect(client.getAccessToken()).toBe('jwt-register');
      expect(res.success).toBe(true);
    });

    test('2. login() triggers POST /auth/login and caches token', async () => {
      mockResponse = new Response(JSON.stringify({ success: true, data: { accessToken: 'jwt-login' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      const payload = { email: 'john@x.com', password: 'pass' };
      await client.auth.login(payload);
      
      expect(lastFetchUrl).toBe(`https://api.bazaara.store/api/v1/stores/${storeId}/auth/login`);
      expect(lastFetchOptions?.method).toBe('POST');
      expect(lastFetchBody).toEqual(payload);
      expect(client.getAccessToken()).toBe('jwt-login');
    });

    test('3. logout() clears cached access token from storage', () => {
      client.auth.logout();
      expect(client.getAccessToken()).toBeNull();
    });

    test('4. getProfile() triggers GET /auth/me with Authorization headers', async () => {
      // Mock log in state
      mockResponse = new Response(JSON.stringify({ success: true, data: { accessToken: 'token-abc' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      await client.auth.login({ email: 'a@a.com', password: '1' });

      // Run profile fetch
      mockResponse = new Response(JSON.stringify({ success: true, data: { email: 'john@x.com' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      await client.auth.getProfile();

      expect(lastFetchUrl).toBe(`https://api.bazaara.store/api/v1/stores/${storeId}/auth/me`);
      expect(lastFetchOptions?.method).toBe('GET');
      expect(lastFetchHeaders['Authorization']).toBe('Bearer token-abc');
    });

    test('5. forgotPassword() triggers POST /auth/forgot-password', async () => {
      await client.auth.forgotPassword('test@x.com');
      expect(lastFetchUrl).toBe(`https://api.bazaara.store/api/v1/stores/${storeId}/auth/forgot-password`);
      expect(lastFetchOptions?.method).toBe('POST');
      expect(lastFetchBody).toEqual({ email: 'test@x.com' });
    });

    test('6. resetPassword() triggers POST /auth/reset-password', async () => {
      const payload = { token: 'tok-123', password: 'new-password' };
      await client.auth.resetPassword(payload);
      expect(lastFetchUrl).toBe(`https://api.bazaara.store/api/v1/stores/${storeId}/auth/reset-password`);
      expect(lastFetchOptions?.method).toBe('POST');
      expect(lastFetchBody).toEqual(payload);
    });
  });

  describe('API Sub-Module: Catalog (4 methods)', () => {
    let client: BazaaraStorefront;
    beforeEach(() => {
      client = new BazaaraStorefront({ storeId, baseUrl: customBaseUrl });
    });

    test('7. getDetails() triggers GET /stores/:storeId', async () => {
      await client.catalog.getDetails();
      expect(lastFetchUrl).toBe(`${customBaseUrl}/stores/${storeId}`);
      expect(lastFetchOptions?.method).toBe('GET');
    });

    test('8. getProducts() parses and builds dynamic query strings correctly', async () => {
      const params = {
        page: 2,
        limit: 25,
        search: 'shirt',
        category: 'clothing',
        minPrice: 5,
        maxPrice: 50,
        sort: 'price_asc',
        tags: 'summer'
      };
      await client.catalog.getProducts(params);
      
      const expectedUrl = `${customBaseUrl}/stores/${storeId}/products?page=2&limit=25&search=shirt&category=clothing&minPrice=5&maxPrice=50&sort=price_asc&tags=summer`;
      expect(lastFetchUrl).toBe(expectedUrl);
      expect(lastFetchOptions?.method).toBe('GET');
    });

    test('9. getProduct() triggers GET /stores/:storeId/products/:productId', async () => {
      await client.catalog.getProduct('p-789');
      expect(lastFetchUrl).toBe(`${customBaseUrl}/stores/${storeId}/products/p-789`);
      expect(lastFetchOptions?.method).toBe('GET');
    });

    test('10. autocomplete() triggers GET /stores/:storeId/products/autocomplete with safe URI encoding', async () => {
      await client.catalog.autocomplete('blue jeans');
      expect(lastFetchUrl).toBe(`${customBaseUrl}/stores/${storeId}/products/autocomplete?q=blue%20jeans`);
      expect(lastFetchOptions?.method).toBe('GET');
    });
  });

  describe('API Sub-Module: Cart (5 methods)', () => {
    let client: BazaaraStorefront;
    beforeEach(() => {
      client = new BazaaraStorefront({ storeId });
    });

    test('11. get() triggers GET /stores/:storeId/cart', async () => {
      await client.cart.get();
      expect(lastFetchUrl).toBe(`https://api.bazaara.store/api/v1/stores/${storeId}/cart`);
      expect(lastFetchOptions?.method).toBe('GET');
    });

    test('12. addItem() triggers POST /stores/:storeId/cart/items with parameters', async () => {
      await client.cart.addItem('prod-99', 3, { size: 'XL' });
      expect(lastFetchUrl).toBe(`https://api.bazaara.store/api/v1/stores/${storeId}/cart/items`);
      expect(lastFetchOptions?.method).toBe('POST');
      expect(lastFetchBody).toEqual({ productId: 'prod-99', quantity: 3, variantInfo: { size: 'XL' } });
    });

    test('13. updateItem() triggers PUT /stores/:storeId/cart/items/:itemId', async () => {
      await client.cart.updateItem('item-12', 4);
      expect(lastFetchUrl).toBe(`https://api.bazaara.store/api/v1/stores/${storeId}/cart/items/item-12`);
      expect(lastFetchOptions?.method).toBe('PUT');
      expect(lastFetchBody).toEqual({ quantity: 4 });
    });

    test('14. removeItem() triggers DELETE /stores/:storeId/cart/items/:itemId', async () => {
      await client.cart.removeItem('item-12');
      expect(lastFetchUrl).toBe(`https://api.bazaara.store/api/v1/stores/${storeId}/cart/items/item-12`);
      expect(lastFetchOptions?.method).toBe('DELETE');
    });

    test('15. clear() triggers DELETE /stores/:storeId/cart', async () => {
      await client.cart.clear();
      expect(lastFetchUrl).toBe(`https://api.bazaara.store/api/v1/stores/${storeId}/cart`);
      expect(lastFetchOptions?.method).toBe('DELETE');
    });
  });

  describe('API Sub-Module: Checkout (1 method)', () => {
    test('16. process() triggers POST /stores/:storeId/checkout with payloads', async () => {
      const client = new BazaaraStorefront({ storeId });
      const payload = {
        email: 'dev@x.com',
        phone: '9999',
        shippingAddress: { firstName: 'A', lastName: 'B', addressLine1: 'Road', city: 'City', state: 'State', zipCode: '123', country: 'IN', phone: '9' },
        paymentMethod: 'stripe' as const
      };
      await client.checkout.process(payload);
      
      expect(lastFetchUrl).toBe(`https://api.bazaara.store/api/v1/stores/${storeId}/checkout`);
      expect(lastFetchOptions?.method).toBe('POST');
      expect(lastFetchBody).toEqual(payload);
    });
  });

  describe('API Sub-Module: Coupons & Newsletter (2 methods)', () => {
    let client: BazaaraStorefront;
    beforeEach(() => {
      client = new BazaaraStorefront({ storeId });
    });

    test('17. coupons.validate() triggers POST /stores/:storeId/coupons/validate', async () => {
      await client.coupons.validate('SAVE50');
      expect(lastFetchUrl).toBe(`https://api.bazaara.store/api/v1/stores/${storeId}/coupons/validate`);
      expect(lastFetchOptions?.method).toBe('POST');
      expect(lastFetchBody).toEqual({ code: 'SAVE50' });
    });

    test('18. newsletter.subscribe() triggers POST /stores/:storeId/newsletter/subscribe', async () => {
      await client.newsletter.subscribe('mail@x.com');
      expect(lastFetchUrl).toBe(`https://api.bazaara.store/api/v1/stores/${storeId}/newsletter/subscribe`);
      expect(lastFetchOptions?.method).toBe('POST');
      expect(lastFetchBody).toEqual({ email: 'mail@x.com' });
    });
  });

  describe('API Sub-Module: Reviews (2 methods)', () => {
    let client: BazaaraStorefront;
    beforeEach(() => {
      client = new BazaaraStorefront({ storeId });
    });

    test('19. reviews.getProductReviews() triggers GET /stores/:storeId/products/:productId/reviews', async () => {
      await client.reviews.getProductReviews('prod-1');
      expect(lastFetchUrl).toBe(`https://api.bazaara.store/api/v1/stores/${storeId}/products/prod-1/reviews`);
      expect(lastFetchOptions?.method).toBe('GET');
    });

    test('20. reviews.createProductReview() triggers POST /stores/:storeId/products/:productId/reviews', async () => {
      // Setup login auth
      mockResponse = new Response(JSON.stringify({ success: true, data: { accessToken: 'jwt-review' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      await client.auth.login({ email: 'review@x.com', password: '1' });

      // Run create review
      mockResponse = new Response(JSON.stringify({ success: true, data: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      const payload = { rating: 5, comment: 'Awesome product!' };
      await client.reviews.createProductReview('prod-1', payload);

      expect(lastFetchUrl).toBe(`https://api.bazaara.store/api/v1/stores/${storeId}/products/prod-1/reviews`);
      expect(lastFetchOptions?.method).toBe('POST');
      expect(lastFetchHeaders['Authorization']).toBe('Bearer jwt-review');
      expect(lastFetchBody).toEqual(payload);
    });
  });

  describe('API Sub-Module: Customer Dashboard (9 methods)', () => {
    let client: BazaaraStorefront;
    beforeEach(async () => {
      client = new BazaaraStorefront({ storeId });
      // Login to satisfy authentication requirement
      mockResponse = new Response(JSON.stringify({ success: true, data: { accessToken: 'tok-customer' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      await client.auth.login({ email: 'c@c.com', password: '1' });
      mockResponse = null; // Clear mockResponse for subsequent queries
    });

    test('21. customer.getOrders() triggers GET /customers/orders', async () => {
      await client.customer.getOrders();
      expect(lastFetchUrl).toBe(`https://api.bazaara.store/api/v1/stores/${storeId}/customers/orders`);
      expect(lastFetchOptions?.method).toBe('GET');
      expect(lastFetchHeaders['Authorization']).toBe('Bearer tok-customer');
    });

    test('22. customer.getOrderById() triggers GET /customers/orders/:orderId', async () => {
      await client.customer.getOrderById('order-999');
      expect(lastFetchUrl).toBe(`https://api.bazaara.store/api/v1/stores/${storeId}/customers/orders/order-999`);
      expect(lastFetchOptions?.method).toBe('GET');
    });

    test('23. customer.getWishlist() triggers GET /wishlist', async () => {
      await client.customer.getWishlist();
      expect(lastFetchUrl).toBe(`https://api.bazaara.store/api/v1/stores/${storeId}/wishlist`);
      expect(lastFetchOptions?.method).toBe('GET');
    });

    test('24. customer.addWishlistItem() triggers POST /wishlist with body', async () => {
      await client.customer.addWishlistItem('prod-44');
      expect(lastFetchUrl).toBe(`https://api.bazaara.store/api/v1/stores/${storeId}/wishlist`);
      expect(lastFetchOptions?.method).toBe('POST');
      expect(lastFetchBody).toEqual({ productId: 'prod-44' });
    });

    test('25. customer.removeWishlistItem() triggers DELETE /wishlist/:productId', async () => {
      await client.customer.removeWishlistItem('prod-44');
      expect(lastFetchUrl).toBe(`https://api.bazaara.store/api/v1/stores/${storeId}/wishlist/prod-44`);
      expect(lastFetchOptions?.method).toBe('DELETE');
    });

    test('26. customer.getAddresses() triggers GET /customers/addresses', async () => {
      await client.customer.getAddresses();
      expect(lastFetchUrl).toBe(`https://api.bazaara.store/api/v1/stores/${storeId}/customers/addresses`);
      expect(lastFetchOptions?.method).toBe('GET');
    });

    test('27. customer.addAddress() triggers POST /customers/addresses', async () => {
      const payload = { firstName: 'Jane', lastName: 'Doe', addressLine1: 'St', city: 'C', state: 'S', zipCode: '1', country: 'IN', phone: '9' };
      await client.customer.addAddress(payload);
      expect(lastFetchUrl).toBe(`https://api.bazaara.store/api/v1/stores/${storeId}/customers/addresses`);
      expect(lastFetchOptions?.method).toBe('POST');
      expect(lastFetchBody).toEqual(payload);
    });

    test('28. customer.updateAddress() triggers PUT /customers/addresses/:addressId', async () => {
      const payload = { addressLine1: 'New St' };
      await client.customer.updateAddress('addr-1', payload);
      expect(lastFetchUrl).toBe(`https://api.bazaara.store/api/v1/stores/${storeId}/customers/addresses/addr-1`);
      expect(lastFetchOptions?.method).toBe('PUT');
      expect(lastFetchBody).toEqual(payload);
    });

    test('29. customer.removeAddress() triggers DELETE /customers/addresses/:addressId', async () => {
      await client.customer.removeAddress('addr-1');
      expect(lastFetchUrl).toBe(`https://api.bazaara.store/api/v1/stores/${storeId}/customers/addresses/addr-1`);
      expect(lastFetchOptions?.method).toBe('DELETE');
    });
  });

  describe('Error Mapping & Guest Session Lifecycle Rotation', () => {
    test('Throws BazaaraError on HTTP failures carrying statuses and error maps', async () => {
      const client = new BazaaraStorefront({ storeId });
      mockResponse = new Response(JSON.stringify({
        success: false,
        message: 'Insufficient stock.',
        errors: { quantity: ['Product only has 2 items left.'] }
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });

      try {
        await client.cart.addItem('p-1', 10);
        expect(true).toBe(false); // Fail if error not thrown
      } catch (err: any) {
        expect(BazaaraError.isBazaaraError(err)).toBe(true);
        expect(err.status).toBe(409);
        expect(err.message).toBe('Insufficient stock.');
        expect(err.errors).toEqual({ quantity: ['Product only has 2 items left.'] });
        expect(err.raw).toBeDefined();
      }
    });

    test('BazaaraError cleanly wraps network/connection failures with code 0', async () => {
      const client = new BazaaraStorefront({ storeId });
      globalThis.fetch = async () => {
        throw new Error('Connection Timeout.');
      };

      try {
        await client.catalog.getDetails();
        expect(true).toBe(false);
      } catch (err: any) {
        expect(BazaaraError.isBazaaraError(err)).toBe(true);
        expect(err.status).toBe(0);
        expect(err.message).toBe('Connection Timeout.');
      }
    });

    test('Captures rotated guest tokens in response headers and injects them in subsequent calls', async () => {
      const client = new BazaaraStorefront({ storeId });
      expect(client.getGuestToken()).toBeNull();

      mockResponse = new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Guest-Token': 'rotated-guest-token-999'
        }
      });

      // Triggers header capture
      await client.cart.get();
      expect(client.getGuestToken()).toBe('rotated-guest-token-999');

      // Check next fetch sends it
      await client.cart.get();
      expect(lastFetchHeaders['X-Guest-Token']).toBe('rotated-guest-token-999');
    });
  });
});
