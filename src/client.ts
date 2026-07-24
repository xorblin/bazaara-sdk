import { BazaaraError } from './error';
import {
  SignUpInput,
  LoginInput,
  GetProductsParams,
  CheckoutInput,
  CreateReviewInput,
  Address,
  Cart,
  Order,
  Product,
  Store,
  Review,
  BazaaraApiResponse
} from './types';

export interface BazaaraStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

class MemoryStorage implements BazaaraStorage {
  private cache = new Map<string, string>();
  getItem(key: string): string | null {
    return this.cache.get(key) || null;
  }
  setItem(key: string, value: string): void {
    this.cache.set(key, value);
  }
  removeItem(key: string): void {
    this.cache.delete(key);
  }
}

export interface BazaaraStorefrontConfig {
  storeId: string;
  apiKey?: string;
  baseUrl?: string;
  storage?: BazaaraStorage;
}

export class BazaaraStorefront {
  private baseUrl: string;
  private storeId: string;
  private apiKey?: string;
  private storage: BazaaraStorage;

  private readonly ACCESS_TOKEN_KEY: string;
  private readonly GUEST_TOKEN_KEY: string;

  constructor(config: BazaaraStorefrontConfig) {
    if (!config.storeId) {
      throw new Error('BazaaraStorefront requires a storeId.');
    }
    this.storeId = config.storeId;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.bazaara.store/api/v1';

    this.ACCESS_TOKEN_KEY = `bazaara_${config.storeId}_access_token`;
    this.GUEST_TOKEN_KEY = `bazaara_${config.storeId}_guest_token`;

    // Resolve storage driver
    if (config.storage) {
      this.storage = config.storage;
    } else if (typeof window !== 'undefined' && window.localStorage) {
      this.storage = window.localStorage;
    } else {
      this.storage = new MemoryStorage();
    }
  }

  /**
   * Helper to execute requests and handle token rotation and custom errors
   */
  private async request<T>(
    method: string,
    path: string,
    body?: any,
    requireAuth = false
  ): Promise<BazaaraApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['X-Bazaara-API-Key'] = this.apiKey;
    }

    const accessToken = this.storage.getItem(this.ACCESS_TOKEN_KEY);
    const guestToken = this.storage.getItem(this.GUEST_TOKEN_KEY);

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    if (guestToken) {
      headers['X-Guest-Token'] = guestToken;
    }

    const config: RequestInit = {
      method,
      headers,
    };

    if (body !== undefined) {
      config.body = JSON.stringify(body);
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/stores/${this.storeId}${path}`, config);
    } catch (netErr: any) {
      throw new BazaaraError(netErr.message || 'Network request failed.', 0);
    }

    // Capture guest token rotation in headers
    const responseGuestToken = response.headers.get('X-Guest-Token');
    if (responseGuestToken) {
      this.storage.setItem(this.GUEST_TOKEN_KEY, responseGuestToken);
    }

    const contentType = response.headers.get('Content-Type');
    let data: any = null;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    }

    if (!response.ok) {
      const errorMsg = data?.message || `Request failed with status ${response.status}`;
      const errorDetails = data?.errors || undefined;
      throw new BazaaraError(errorMsg, response.status, errorDetails, data);
    }

    return data;
  }

  // --- Authentication ---
  public auth = {
    signup: async (payload: SignUpInput): Promise<BazaaraApiResponse<{ user: any; accessToken: string }>> => {
      const response = await this.request<{ user: any; accessToken: string }>('POST', '/auth/signup', payload);
      if (response.data?.accessToken) {
        this.storage.setItem(this.ACCESS_TOKEN_KEY, response.data.accessToken);
      }
      return response;
    },

    login: async (payload: LoginInput): Promise<BazaaraApiResponse<{ user: any; accessToken: string }>> => {
      const response = await this.request<{ user: any; accessToken: string }>('POST', '/auth/login', payload);
      if (response.data?.accessToken) {
        this.storage.setItem(this.ACCESS_TOKEN_KEY, response.data.accessToken);
      }
      return response;
    },

    logout: (): void => {
      this.storage.removeItem(this.ACCESS_TOKEN_KEY);
    },

    getProfile: async (): Promise<BazaaraApiResponse<any>> => {
      return this.request<any>('GET', '/auth/me', undefined, true);
    },

    forgotPassword: async (email: string): Promise<BazaaraApiResponse<{ success: boolean }>> => {
      return this.request<{ success: boolean }>('POST', '/auth/forgot-password', { email });
    },

    resetPassword: async (payload: Record<string, string>): Promise<BazaaraApiResponse<{ success: boolean }>> => {
      return this.request<{ success: boolean }>('POST', '/auth/reset-password', payload);
    }
  };

  // --- Catalog (Products & Store details) ---
  public catalog = {
    getDetails: async (): Promise<BazaaraApiResponse<Store>> => {
      return this.request<Store>('GET', '');
    },

    getProducts: async (params?: GetProductsParams): Promise<BazaaraApiResponse<Product[]>> => {
      let path = '/products';
      if (params) {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, val]) => {
          if (val !== undefined && val !== null) {
            queryParams.append(key, String(val));
          }
        });
        const queryString = queryParams.toString();
        if (queryString) {
          path += `?${queryString}`;
        }
      }
      return this.request<Product[]>('GET', path);
    },

    getProduct: async (productId: string): Promise<BazaaraApiResponse<Product>> => {
      return this.request<Product>('GET', `/products/${productId}`);
    },

    autocomplete: async (query: string): Promise<BazaaraApiResponse<Array<{ id: string; name: string }>>> => {
      return this.request<Array<{ id: string; name: string }>>('GET', `/products/autocomplete?q=${encodeURIComponent(query)}`);
    }
  };

  // --- Cart ---
  public cart = {
    get: async (): Promise<BazaaraApiResponse<Cart>> => {
      return this.request<Cart>('GET', '/cart');
    },

    addItem: async (productId: string, quantity = 1, variantInfo?: Record<string, any>): Promise<BazaaraApiResponse<Cart>> => {
      return this.request<Cart>('POST', '/cart/items', { productId, quantity, variantInfo });
    },

    updateItem: async (itemId: string, quantity: number): Promise<BazaaraApiResponse<Cart>> => {
      return this.request<Cart>('PUT', `/cart/items/${itemId}`, { quantity });
    },

    removeItem: async (itemId: string): Promise<BazaaraApiResponse<Cart>> => {
      return this.request<Cart>('DELETE', `/cart/items/${itemId}`);
    },

    clear: async (): Promise<BazaaraApiResponse<Cart>> => {
      return this.request<Cart>('DELETE', '/cart');
    }
  };

  // --- Checkout ---
  public checkout = {
    process: async (payload: CheckoutInput): Promise<BazaaraApiResponse<Order>> => {
      return this.request<Order>('POST', '/checkout', payload);
    }
  };

  // --- Coupons & Marketing ---
  public coupons = {
    validate: async (code: string): Promise<BazaaraApiResponse<{ isValid: boolean; discountAmount: number; coupon: any }>> => {
      return this.request<{ isValid: boolean; discountAmount: number; coupon: any }>('POST', '/coupons/validate', { code });
    }
  };

  public newsletter = {
    subscribe: async (email: string): Promise<BazaaraApiResponse<{ success: boolean }>> => {
      return this.request<{ success: boolean }>('POST', '/newsletter/subscribe', { email });
    }
  };

  // --- Product Reviews ---
  public reviews = {
    getProductReviews: async (productId: string): Promise<BazaaraApiResponse<Review[]>> => {
      return this.request<Review[]>('GET', `/products/${productId}/reviews`);
    },

    createProductReview: async (productId: string, payload: CreateReviewInput): Promise<BazaaraApiResponse<Review>> => {
      return this.request<Review>('POST', `/products/${productId}/reviews`, payload, true);
    }
  };

  // --- Customer Dashboard APIs ---
  public customer = {
    getOrders: async (): Promise<BazaaraApiResponse<Order[]>> => {
      return this.request<Order[]>('GET', '/customers/orders', undefined, true);
    },

    getOrderById: async (orderId: string): Promise<BazaaraApiResponse<Order>> => {
      return this.request<Order>('GET', `/customers/orders/${orderId}`, undefined, true);
    },

    getWishlist: async (): Promise<BazaaraApiResponse<Array<{ id: string; productId: string; product: Product }>>> => {
      return this.request<Array<{ id: string; productId: string; product: Product }>>('GET', '/wishlist', undefined, true);
    },

    addWishlistItem: async (productId: string): Promise<BazaaraApiResponse<any>> => {
      return this.request<any>('POST', '/wishlist', { productId }, true);
    },

    removeWishlistItem: async (productId: string): Promise<BazaaraApiResponse<any>> => {
      return this.request<any>('DELETE', `/wishlist/${productId}`, undefined, true);
    },

    getAddresses: async (): Promise<BazaaraApiResponse<Address[]>> => {
      return this.request<Address[]>('GET', '/customers/addresses', undefined, true);
    },

    addAddress: async (address: Omit<Address, 'id'>): Promise<BazaaraApiResponse<Address>> => {
      return this.request<Address>('POST', '/customers/addresses', address, true);
    },

    updateAddress: async (addressId: string, address: Partial<Omit<Address, 'id'>>): Promise<BazaaraApiResponse<Address>> => {
      return this.request<Address>('PUT', `/customers/addresses/${addressId}`, address, true);
    },

    removeAddress: async (addressId: string): Promise<BazaaraApiResponse<{ success: boolean }>> => {
      return this.request<{ success: boolean }>('DELETE', `/customers/addresses/${addressId}`, undefined, true);
    }
  };

  // --- Token Getters for convenience ---
  public getAccessToken(): string | null {
    return this.storage.getItem(this.ACCESS_TOKEN_KEY);
  }

  public getGuestToken(): string | null {
    return this.storage.getItem(this.GUEST_TOKEN_KEY);
  }
}
