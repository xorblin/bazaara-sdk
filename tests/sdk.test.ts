import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { BazaaraStorefront } from '../src/client';
import { BazaaraError } from '../src/error';

describe('BazaaraStorefront SDK', () => {
  const storeId = 'test-store-123';
  const customBaseUrl = 'https://custom-api.bazaara.store/api/v1';

  let originalFetch: typeof fetch;
  let lastFetchUrl: string | null = null;
  let lastFetchOptions: RequestInit | null = null;
  let mockResponse: Response | null = null;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    lastFetchUrl = null;
    lastFetchOptions = null;
    mockResponse = null;

    // Custom fetch mock
    globalThis.fetch = (async (url: string | URL, options?: RequestInit) => {
      lastFetchUrl = String(url);
      lastFetchOptions = options || null;
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

  describe('Instantiation', () => {
    test('should initialize with correct storeId and default baseUrl', () => {
      const client = new BazaaraStorefront({ storeId });
      expect(client).toBeDefined();
      expect(client.getAccessToken()).toBeNull();
      expect(client.getGuestToken()).toBeNull();
    });

    test('should initialize with custom baseUrl', async () => {
      const client = new BazaaraStorefront({ storeId, baseUrl: customBaseUrl });
      await client.catalog.getDetails();
      expect(lastFetchUrl).toContain(customBaseUrl);
    });

    test('should throw error if storeId is missing', () => {
      expect(() => new BazaaraStorefront({ storeId: '' })).toThrow();
    });

    test('should resolve custom storage adapter', () => {
      const storageCache = new Map<string, string>();
      const customStorage = {
        getItem: (key: string) => storageCache.get(key) || null,
        setItem: (key: string, value: string) => { storageCache.set(key, value); },
        removeItem: (key: string) => { storageCache.delete(key); },
      };

      const client = new BazaaraStorefront({ storeId, storage: customStorage });
      client.auth.logout(); // triggers removeItem internally
      expect(client.getAccessToken()).toBeNull();
    });
  });

  describe('Request headers and token injection', () => {
    test('should inject Bearer token if accessToken is stored', async () => {
      const client = new BazaaraStorefront({ storeId });
      
      // Inject access token by simulating a successful login response
      mockResponse = new Response(
        JSON.stringify({ success: true, data: { accessToken: 'jwt-token-xyz', user: {} } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
      await client.auth.login({ email: 'test@bazaara.com', password: 'password' });

      // Run profile query
      mockResponse = new Response(JSON.stringify({ success: true, data: { name: 'Test User' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      await client.auth.getProfile();

      expect(lastFetchOptions?.headers).toBeDefined();
      const headers = lastFetchOptions!.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer jwt-token-xyz');
    });

    test('should inject X-Guest-Token if guestToken is stored', async () => {
      const client = new BazaaraStorefront({ storeId });

      // Set a mock guest token in headers
      mockResponse = new Response(JSON.stringify({ success: true, data: { items: [] } }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Guest-Token': 'guest-token-123',
        },
      });

      // Get cart to trigger header capture
      await client.cart.get();
      expect(client.getGuestToken()).toBe('guest-token-123');

      // Perform another request and verify guest token is sent
      await client.cart.get();
      const headers = lastFetchOptions!.headers as Record<string, string>;
      expect(headers['X-Guest-Token']).toBe('guest-token-123');
    });

    test('should handle guest token rotation', async () => {
      const client = new BazaaraStorefront({ storeId });

      // First response sets guest-token-123
      mockResponse = new Response(JSON.stringify({ success: true, data: {} }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Guest-Token': 'guest-token-123',
        },
      });
      await client.cart.get();
      expect(client.getGuestToken()).toBe('guest-token-123');

      // Second response rotates guest token to guest-token-456
      mockResponse = new Response(JSON.stringify({ success: true, data: {} }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Guest-Token': 'guest-token-456',
        },
      });
      await client.cart.addItem('product-id');
      expect(client.getGuestToken()).toBe('guest-token-456');
    });
  });

  describe('API Endpoints Mapping', () => {
    let client: BazaaraStorefront;

    beforeEach(() => {
      client = new BazaaraStorefront({ storeId });
    });

    test('catalog.getDetails hits GET /stores/:storeId', async () => {
      await client.catalog.getDetails();
      expect(lastFetchUrl).toBe(`https://api.bazaara.store/api/v1/stores/${storeId}`);
      expect(lastFetchOptions?.method).toBe('GET');
    });

    test('catalog.getProducts hits GET /stores/:storeId/products with query string', async () => {
      await client.catalog.getProducts({ page: 2, limit: 12, category: 'Apparel' });
      expect(lastFetchUrl).toBe(`https://api.bazaara.store/api/v1/stores/${storeId}/products?page=2&limit=12&category=Apparel`);
      expect(lastFetchOptions?.method).toBe('GET');
    });

    test('cart.addItem hits POST /stores/:storeId/cart/items', async () => {
      await client.cart.addItem('prod-1', 2, { color: 'Blue' });
      expect(lastFetchUrl).toBe(`https://api.bazaara.store/api/v1/stores/${storeId}/cart/items`);
      expect(lastFetchOptions?.method).toBe('POST');
      expect(lastFetchOptions?.body).toBe(JSON.stringify({ productId: 'prod-1', quantity: 2, variantInfo: { color: 'Blue' } }));
    });

    test('checkout.process hits POST /stores/:storeId/checkout', async () => {
      const checkoutPayload: any = {
        email: 'customer@gmail.com',
        phone: '1234567890',
        paymentMethod: 'stripe',
        shippingAddress: { firstName: 'John', lastName: 'Doe', addressLine1: '123 St', city: 'NY', state: 'NY', zipCode: '10001', country: 'US', phone: '12345' }
      };
      await client.checkout.process(checkoutPayload);
      expect(lastFetchUrl).toBe(`https://api.bazaara.store/api/v1/stores/${storeId}/checkout`);
      expect(lastFetchOptions?.method).toBe('POST');
      expect(lastFetchOptions?.body).toBe(JSON.stringify(checkoutPayload));
    });

    test('reviews.createProductReview hits POST /stores/:storeId/products/:productId/reviews', async () => {
      await client.reviews.createProductReview('prod-1', { rating: 5, comment: 'Nice!' });
      expect(lastFetchUrl).toBe(`https://api.bazaara.store/api/v1/stores/${storeId}/products/prod-1/reviews`);
      expect(lastFetchOptions?.method).toBe('POST');
    });
  });

  describe('Error Handling', () => {
    test('should throw BazaaraError on API failure responses', async () => {
      const client = new BazaaraStorefront({ storeId });
      
      mockResponse = new Response(
        JSON.stringify({
          success: false,
          message: 'Validation failed.',
          errors: { email: ['Email is invalid.'] },
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      try {
        await client.auth.login({ email: 'bad-email', password: '123' });
        // Fail if no error thrown
        expect(true).toBe(false);
      } catch (err: any) {
        expect(BazaaraError.isBazaaraError(err)).toBe(true);
        expect(err.status).toBe(400);
        expect(err.message).toBe('Validation failed.');
        expect(err.errors).toEqual({ email: ['Email is invalid.'] });
      }
    });

    test('should wrap network/connection issues in BazaaraError', async () => {
      const client = new BazaaraStorefront({ storeId });

      globalThis.fetch = async () => {
        throw new Error('Connection refused.');
      };

      try {
        await client.catalog.getDetails();
        expect(true).toBe(false);
      } catch (err: any) {
        expect(BazaaraError.isBazaaraError(err)).toBe(true);
        expect(err.status).toBe(0);
        expect(err.message).toBe('Connection refused.');
      }
    });
  });
});
