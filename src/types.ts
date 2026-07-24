export type ProductStatus = 'active' | 'draft' | 'archived';

export interface ProductVariant {
  id: string;
  name: string;
  sku?: string;
  price: number;
  compareAtPrice?: number | null;
  stock: number;
  options: Record<string, string>; // e.g. { size: 'M', color: 'Red' }
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  sku: string;
  price: number;
  compareAtPrice: number | null;
  costPerItem: number | null;
  stock: number;
  lowStockAlertThreshold: number;
  trackInventory: boolean;
  category: string | null;
  tags: string[];
  variants: ProductVariant[];
  images: string[];
  status: ProductStatus;
  storeId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Store {
  id: string;
  name: string;
  description: string | null;
  companyName: string;
  registrationNumber: string;
  supportEmail: string;
  supportPhone: string;
  address: string;
  currency: string | null;
  dispatchPort: string | null;
  onboardingCompleted: boolean;
  onboardingStatus: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  variantInfo?: Record<string, any>;
  price?: number; // Price of the item at the time of adding
  product?: {
    name: string;
    images: string[];
    price: number;
    sku: string;
  };
}

export interface Cart {
  id: string;
  userId: string | null;
  guestToken: string | null;
  items: CartItem[];
  expiresAt: string | null;
  storeId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  id: string;
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  sku: string;
  variantInfo?: Record<string, any>;
  image?: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'returned' | 'refunded';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded';

export interface Order {
  id: string;
  orderNumber: string;
  userId: string | null;
  guestToken: string | null;
  storeId: string;
  items: OrderItem[];
  subtotal: number;
  discountCode: string | null;
  discountAmount: number;
  taxAmount: number;
  shippingAmount: number;
  totalAmount: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  paymentId: string | null;
  shippingAddress: Address;
  billingAddress: Address;
  shippingMethod: string | null;
  trackingNumber: string | null;
  trackingCarrier: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minOrderValue?: number | null;
  maxDiscount?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  status: 'active' | 'inactive';
}

export interface Review {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  images: string[];
  videos: string[];
  userId: string | null;
  userName: string;
  productId: string;
  storeId: string;
  isVerifiedPurchase: boolean;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

// API Input Interfaces
export interface SignUpInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface GetProductsParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string; // e.g. "price_asc", "price_desc", "newest"
  tags?: string | string[];
}

export interface CheckoutInput {
  email: string;
  phone: string;
  shippingAddress: Omit<Address, 'id'>;
  billingAddress?: Omit<Address, 'id'>; // defaults to shipping address if omitted
  shippingMethod?: string;
  paymentMethod: 'stripe' | 'razorpay' | 'paypal' | 'cod';
  paymentId?: string; // ID from gateway after processing
  couponCode?: string;
}

export interface CreateReviewInput {
  rating: number;
  title?: string;
  comment?: string;
  images?: string[];
  videos?: string[];
}

export interface BazaaraApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    totalCount?: number;
    totalPages?: number;
  };
}
