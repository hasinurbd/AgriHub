/**
 * AgriHub Enterprise SaaS - Initial State & Domain Model
 */

export interface ProductItem {
  id: number;
  farmer_id?: number;
  farmerName: string;
  farmLocation: string;
  category: string;
  category_id?: number;
  title: string;
  batchNumber: string;
  harvestDate: string;
  expiryDate?: string;
  unitPrice: number;
  unitType: string;
  quantityAvailable: number;
  storageTempCelsius: number;
  isOrganic: boolean;
  status: 'active' | 'low_stock' | 'out_of_stock' | 'archived';
  imageUrl?: string;
}

export interface OrderLineItem {
  productId?: number;
  title: string;
  batchNumber: string;
  unitPrice: number;
  quantity: number;
  unitType: string;
  lineTotal: number;
}

export interface OrderItem {
  id: number;
  invoiceNumber?: string;
  orderNumber: string;
  buyerName: string;
  buyerEmail?: string;
  buyerPhone?: string;
  productTitle: string;
  batchNumber: string;
  unitPrice?: number;
  quantity: number;
  unitType: string;
  items?: OrderLineItem[];
  subtotal?: number;
  shippingFee?: number;
  discountAmount?: number;
  couponCode?: string;
  taxAmount?: number;
  totalAmount: number;
  paymentMethod?: 'bkash_nagad' | 'bank_escrow' | 'cod' | string;
  paymentStatus: 'paid' | 'escrow_held' | 'pending' | 'refunded';
  orderStatus: 'placed' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  deliveryAddress?: string;
  notes?: string;
  createdAt: string;
}

export interface LogisticsShipment {
  id: number;
  trackingCode: string;
  orderNumber: string;
  product: string;
  supplierName: string;
  vehicleNumber: string;
  driverName: string;
  driverPhone: string;
  currentTempCelsius: number;
  targetTempCelsius: number;
  originHub: string;
  destinationHub: string;
  status: 'assigned' | 'dispatched' | 'in_transit' | 'customs_inspection' | 'arrived' | 'delivered' | 'delayed';
  eta: string;
  checkpoints: { time: string; location: string; note: string }[];
}

export interface CategoryItem {
  id: number;
  name: string;
  slug: string;
  description: string;
  skuCount: number;
  tempRange: string;
  iconName: string;
}

export interface UserItem {
  id: number;
  role: 'admin' | 'farmer' | 'supplier' | 'buyer';
  full_name: string;
  email: string;
  phone: string;
  business_name: string;
  tax_or_nid_no: string;
  address: string;
  is_verified: boolean;
  created_at: string;
}

export interface AuditLogItem {
  id: number;
  action: string;
  actor: string;
  role: string;
  ip_address: string;
  target: string;
  created_at: string;
  details: Record<string, any>;
}

export interface WarehouseItem {
  id: number;
  code: string;
  name: string;
  region: string;
  address: string;
  capacityTons: number;
  occupiedTons: number;
  tempRangeCelsius: string;
  managerName: string;
  status: 'operational' | 'near_capacity' | 'maintenance';
}

import {
  SEED_PRODUCTS,
  SEED_WAREHOUSES
} from './data/seedData';

export const INITIAL_WAREHOUSES: WarehouseItem[] = SEED_WAREHOUSES;
export const INITIAL_PRODUCTS: ProductItem[] = SEED_PRODUCTS;

export const INITIAL_CATEGORIES: CategoryItem[] = [
  {
    id: 1,
    name: 'Fruits & Berries',
    slug: 'fruits-berries',
    description: 'Fresh orchard produce, tropical fruits, and delicate berries requiring chilled handling.',
    skuCount: 14,
    tempRange: '2.0°C – 6.0°C',
    iconName: 'Apple'
  },
  {
    id: 2,
    name: 'Grains & Cereals',
    slug: 'grains-cereals',
    description: 'Paddy rice, milled basmati, corn, and wheat crops stored in ambient dry silos.',
    skuCount: 38,
    tempRange: '15.0°C – 20.0°C',
    iconName: 'Wheat'
  },
  {
    id: 3,
    name: 'Dairy & Cold Chain',
    slug: 'dairy-cold-chain',
    description: 'Pasteurized whole milk, organic butter, and temperature-sensitive dairy fats.',
    skuCount: 9,
    tempRange: '2.0°C – 4.0°C',
    iconName: 'Milk'
  },
  {
    id: 4,
    name: 'Oils & Seeds',
    slug: 'oils-seeds',
    description: 'Virgin mustard seeds, sunflower oil, and cold-pressed edible seed extracts.',
    skuCount: 22,
    tempRange: '18.0°C – 24.0°C',
    iconName: 'Droplet'
  },
  {
    id: 5,
    name: 'Vegetables',
    slug: 'vegetables',
    description: 'Hydroponic leafy greens, organic carrots, and seasonal greenhouse crops.',
    skuCount: 41,
    tempRange: '4.0°C – 8.0°C',
    iconName: 'Carrot'
  }
];

export const INITIAL_ORDERS: OrderItem[] = [
  {
    id: 501,
    invoiceNumber: 'INV-2026-0501',
    orderNumber: 'AGRI-ORD-2026-081',
    buyerName: 'FreshBasket Supermarkets Ltd.',
    buyerEmail: 'procure@freshbasket.com',
    buyerPhone: '+880 1733-333333',
    productTitle: 'Grade-A Organic Hass Avocados',
    batchNumber: 'BATCH-2026-AVO-881',
    unitPrice: 240,
    quantity: 650,
    unitType: 'kg',
    items: [
      {
        productId: 1,
        title: 'Grade-A Organic Hass Avocados',
        batchNumber: 'BATCH-2026-AVO-881',
        unitPrice: 240,
        quantity: 650,
        unitType: 'kg',
        lineTotal: 156000
      }
    ],
    subtotal: 156000,
    shippingFee: 0,
    discountAmount: 0,
    taxAmount: 7800,
    totalAmount: 163800,
    paymentMethod: 'bank_escrow',
    paymentStatus: 'escrow_held',
    orderStatus: 'shipped',
    deliveryAddress: 'FreshBasket Central Distribution Center, Sector 4, Tejgaon, Dhaka',
    notes: 'Cold-chain reefer compartment maintained at 4.5°C',
    createdAt: '2026-11-08 14:22'
  },
  {
    id: 502,
    invoiceNumber: 'INV-2026-0502',
    orderNumber: 'AGRI-ORD-2026-082',
    buyerName: 'Apex Food Processing Corp',
    buyerEmail: 'orders@apexfoods.com',
    buyerPhone: '+880 1715-882210',
    productTitle: 'Premium Aromatic Basmati Rice',
    batchNumber: 'BATCH-2026-RIC-419',
    unitPrice: 165,
    quantity: 2500,
    unitType: 'kg',
    items: [
      {
        productId: 2,
        title: 'Premium Aromatic Basmati Rice',
        batchNumber: 'BATCH-2026-RIC-419',
        unitPrice: 165,
        quantity: 2500,
        unitType: 'kg',
        lineTotal: 412500
      }
    ],
    subtotal: 412500,
    shippingFee: 0,
    discountAmount: 15000,
    couponCode: 'AGRI10',
    taxAmount: 19875,
    totalAmount: 417375,
    paymentMethod: 'bank_escrow',
    paymentStatus: 'paid',
    orderStatus: 'processing',
    deliveryAddress: 'Apex Processing Terminal B, Industrial Area, Gazipur',
    notes: 'Moisture-sealed 50kg sacks palletized',
    createdAt: '2026-11-09 09:15'
  },
  {
    id: 503,
    invoiceNumber: 'INV-2026-0503',
    orderNumber: 'AGRI-ORD-2026-083',
    buyerName: 'Metropolitan Hospital Cafeteria',
    buyerEmail: 'catering@metrohospital.org',
    buyerPhone: '+880 1812-449012',
    productTitle: 'Fresh Pasteurized Whole Milk (Chilled)',
    batchNumber: 'BATCH-2026-MLK-003',
    unitPrice: 95,
    quantity: 150,
    unitType: 'liter',
    items: [
      {
        productId: 3,
        title: 'Fresh Pasteurized Whole Milk (Chilled)',
        batchNumber: 'BATCH-2026-MLK-003',
        unitPrice: 95,
        quantity: 150,
        unitType: 'liter',
        lineTotal: 14250
      }
    ],
    subtotal: 14250,
    shippingFee: 450,
    discountAmount: 0,
    taxAmount: 712.5,
    totalAmount: 15412.5,
    paymentMethod: 'bkash_nagad',
    paymentStatus: 'paid',
    orderStatus: 'delivered',
    deliveryAddress: 'Metropolitan Medical Complex Delivery Dock 2, Dhaka',
    notes: 'Morning chilled delivery completed before 07:00',
    createdAt: '2026-11-09 11:40'
  },
  {
    id: 504,
    invoiceNumber: 'INV-2026-0504',
    orderNumber: 'AGRI-ORD-2026-084',
    buyerName: 'Gourmet Greens Retail',
    buyerEmail: 'inventory@gourmetgreens.com',
    buyerPhone: '+880 1911-776543',
    productTitle: 'Crisp Hydroponic Butterhead Lettuce',
    batchNumber: 'BATCH-2026-LET-104',
    unitPrice: 175,
    quantity: 300,
    unitType: 'kg',
    items: [
      {
        productId: 4,
        title: 'Crisp Hydroponic Butterhead Lettuce',
        batchNumber: 'BATCH-2026-LET-104',
        unitPrice: 175,
        quantity: 300,
        unitType: 'kg',
        lineTotal: 52500
      }
    ],
    subtotal: 52500,
    shippingFee: 450,
    discountAmount: 500,
    couponCode: 'FRESH500',
    taxAmount: 2600,
    totalAmount: 55050,
    paymentMethod: 'cod',
    paymentStatus: 'pending',
    orderStatus: 'placed',
    deliveryAddress: 'Gourmet Greens Flagship Store, Gulshan 2, Dhaka',
    notes: 'Cash on delivery after quality check',
    createdAt: '2026-11-10 16:05'
  }
];

export const INITIAL_LOGISTICS: LogisticsShipment[] = [
  {
    id: 901,
    trackingCode: 'TRK-COLD-2026-8812',
    orderNumber: 'AGRI-ORD-2026-081',
    product: 'Grade-A Organic Hass Avocados (650 kg)',
    supplierName: 'AgroCold Logistics Fleet #7',
    vehicleNumber: 'REEFER-BD-4402',
    driverName: 'Rafiqul Islam',
    driverPhone: '+880 1712-394851',
    currentTempCelsius: 4.2,
    targetTempCelsius: 4.5,
    originHub: 'Rajshahi Agro Sorting & Cold Depot',
    destinationHub: 'Dhaka Central Distribution Center',
    status: 'in_transit',
    eta: 'Today, 18:30 GMT+6',
    checkpoints: [
      { time: '08:00', location: 'Farm Gate Picked', note: 'Quality grading passed, loaded into reefer compartment' },
      { time: '11:30', location: 'Rajshahi Cold Hub', note: 'Seal verified #SL-9941, temperature recorded at 4.1°C' },
      { time: '14:45', location: 'Jamuna Bridge Transit Checkpoint', note: 'GPS ping ok, speed 58 km/h, steady 4.2°C' }
    ]
  },
  {
    id: 902,
    trackingCode: 'TRK-DRY-2026-7731',
    orderNumber: 'AGRI-ORD-2026-082',
    product: 'Premium Aromatic Basmati Rice (2,500 kg)',
    supplierName: 'National Freight Logistics',
    vehicleNumber: 'TRUCK-BD-8910',
    driverName: 'Abdul Karim',
    driverPhone: '+880 1819-204899',
    currentTempCelsius: 19.5,
    targetTempCelsius: 20.0,
    originHub: 'Dinajpur Grain Silo Hub',
    destinationHub: 'Gazipur Industrial Milling Depot',
    status: 'assigned',
    eta: 'Tomorrow, 10:00 GMT+6',
    checkpoints: [
      { time: '09:00', location: 'Dinajpur Silo Hub', note: 'Bags palletized and shrink-wrapped' }
    ]
  }
];

export const INITIAL_USERS: UserItem[] = [
  {
    id: 1,
    role: 'admin',
    full_name: 'Sarah Jenkins',
    email: 'admin@agrihub.local',
    phone: '+880 1700-000001',
    business_name: 'AgriHub Central Operations',
    tax_or_nid_no: 'GOV-TAX-90001',
    address: 'Central Agritech Tower, Level 14, Dhaka',
    is_verified: true,
    created_at: '2026-01-10 08:00:00'
  },
  {
    id: 2,
    role: 'farmer',
    full_name: 'Tariq Rahman',
    email: 'farmer@agrihub.local',
    phone: '+880 1711-111111',
    business_name: 'Green Valley Organic Agro Ltd.',
    tax_or_nid_no: 'FARM-REG-4401',
    address: 'Rajshahi Agro Valley, Plot #12',
    is_verified: true,
    created_at: '2026-01-14 11:20:00'
  },
  {
    id: 3,
    role: 'supplier',
    full_name: 'Rafiqul Islam',
    email: 'supplier@agrihub.local',
    phone: '+880 1722-222222',
    business_name: 'AgroCold Logistics Fleet #7',
    tax_or_nid_no: 'LOG-REG-8812',
    address: 'Northern Highway Cargo Depot, Gazipur',
    is_verified: true,
    created_at: '2026-02-01 14:15:00'
  },
  {
    id: 4,
    role: 'buyer',
    full_name: 'David Chowdhury',
    email: 'buyer@agrihub.local',
    phone: '+880 1733-333333',
    business_name: 'FreshBasket Supermarkets Chain',
    tax_or_nid_no: 'RET-REG-1092',
    address: 'Dhaka Wholesale Market Hub, Tejgaon',
    is_verified: true,
    created_at: '2026-02-15 09:45:00'
  },
  {
    id: 5,
    role: 'farmer',
    full_name: 'Selina Akter',
    email: 'selina@northernagro.com',
    phone: '+880 1744-444444',
    business_name: 'Northern Hydroponics Cooperative',
    tax_or_nid_no: 'FARM-REG-9812',
    address: 'Rangpur Agro Tech Park, Plot 4',
    is_verified: true,
    created_at: '2026-03-02 10:10:00'
  }
];

export const INITIAL_AUDIT_LOGS: AuditLogItem[] = [
  {
    id: 1,
    action: 'BATCH_REGISTERED',
    actor: 'Tariq Rahman',
    role: 'farmer',
    ip_address: '103.205.71.4',
    target: 'BATCH-2026-AVO-881',
    created_at: '2026-11-10 14:22:10',
    details: { title: 'Grade-A Organic Hass Avocados', quantity: '3400 kg', temp: '4.5°C' }
  },
  {
    id: 2,
    action: 'ORDER_PAYMENT_SECURED',
    actor: 'David Chowdhury',
    role: 'buyer',
    ip_address: '118.179.220.14',
    target: 'AGRI-ORD-2026-081',
    created_at: '2026-11-10 14:35:45',
    details: { order_number: 'AGRI-ORD-2026-081', amount: 'BDT 156,000', status: 'protected' }
  },
  {
    id: 3,
    action: 'STOCK_UPDATED',
    actor: 'Warehouse Dispatch',
    role: 'system',
    ip_address: '103.205.71.10',
    target: 'BATCH-2026-AVO-881',
    created_at: '2026-11-10 14:35:46',
    details: { deducted: '650 kg', remaining: '2750 kg', status: 'Confirmed' }
  },
  {
    id: 4,
    action: 'REEFER_DISPATCHED',
    actor: 'Rafiqul Islam',
    role: 'supplier',
    ip_address: '182.160.101.99',
    target: 'TRK-COLD-2026-8812',
    created_at: '2026-11-10 15:10:00',
    details: { truck: 'REEFER-BD-4402', driver: 'Rafiqul Islam', temp: '4.2°C' }
  },
  {
    id: 5,
    action: 'TEMP_CHECK_RECORDED',
    actor: 'Cold-Chain Monitor',
    role: 'system',
    ip_address: '182.160.101.99',
    target: 'TRK-COLD-2026-8812',
    created_at: '2026-11-10 16:45:00',
    details: { recorded_temp: '4.2°C', target: '4.5°C', status: 'Optimal' }
  }
];

export const VOLUME_CHART_DATA = [
  { day: 'Mon', intakeKg: 14200, fulfillmentKg: 11800 },
  { day: 'Tue', intakeKg: 18500, fulfillmentKg: 15400 },
  { day: 'Wed', intakeKg: 16100, fulfillmentKg: 17200 },
  { day: 'Thu', intakeKg: 22400, fulfillmentKg: 19800 },
  { day: 'Fri', intakeKg: 28900, fulfillmentKg: 24500 },
  { day: 'Sat', intakeKg: 19300, fulfillmentKg: 18100 },
  { day: 'Sun', intakeKg: 12400, fulfillmentKg: 14200 }
];

export const CATEGORY_DISTRIBUTION = [
  { name: 'Fruits & Berries', share: 34, color: '#15803d' },
  { name: 'Grains & Cereals', share: 28, color: '#3b82f6' },
  { name: 'Vegetables', share: 22, color: '#eab308' },
  { name: 'Dairy & Cold Chain', share: 11, color: '#06b6d4' },
  { name: 'Oils & Seeds', share: 5, color: '#f97316' }
];
