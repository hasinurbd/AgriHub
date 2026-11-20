import type {
  ProductItem,
  OrderItem,
  LogisticsShipment,
  UserItem,
  WarehouseItem
} from '../mockData';

export const SEED_WAREHOUSES: WarehouseItem[] = [
  {
    id: 1,
    code: 'WH-DHK-01',
    name: 'Dhaka Central Cold Hub',
    region: 'Dhaka',
    address: 'Plot 8B, Tejgaon Industrial Corridor, Dhaka',
    capacityTons: 1200,
    occupiedTons: 840,
    tempRangeCelsius: '2°C - 6°C',
    managerName: 'Mahmudul Hasan',
    status: 'operational'
  },
  {
    id: 2,
    code: 'WH-RAJ-02',
    name: 'Rajshahi Orchard & Mango Depot',
    region: 'Rajshahi',
    address: 'Godagari Agro Industrial Zone, Rajshahi',
    capacityTons: 850,
    occupiedTons: 690,
    tempRangeCelsius: '3°C - 8°C',
    managerName: 'Tariqul Islam',
    status: 'near_capacity'
  },
  {
    id: 3,
    code: 'WH-BOG-03',
    name: 'Bogura Northern Vegetable Vault',
    region: 'Bogura',
    address: 'Sherpur Highway Agro Park, Bogura',
    capacityTons: 950,
    occupiedTons: 520,
    tempRangeCelsius: '2°C - 5°C',
    managerName: 'Kamrul Chowdhury',
    status: 'operational'
  },
  {
    id: 4,
    code: 'WH-CTG-04',
    name: 'Chattogram Port Reefer Terminal',
    region: 'Chattogram',
    address: 'Halishahar Export Logistics Park, Chattogram',
    capacityTons: 1500,
    occupiedTons: 910,
    tempRangeCelsius: '0°C - 4°C',
    managerName: 'Nusrat Jahan',
    status: 'operational'
  },
  {
    id: 5,
    code: 'WH-SYL-05',
    name: 'Sylhet Citrus & Dairy Hub',
    region: 'Sylhet',
    address: 'Sreemangal Agro Collection Center, Sylhet',
    capacityTons: 600,
    occupiedTons: 310,
    tempRangeCelsius: '4°C - 12°C',
    managerName: 'Farhan Ahmed',
    status: 'operational'
  }
];

const FARMER_NAMES = [
  ['Tariq Rahman', 'Green Valley Organic Agro Ltd.', 'Rajshahi'],
  ['Abdul Karim', 'Padma Orchard Growers', 'Chapainawabganj'],
  ['Sadia Afrin', 'Dinajpur Golden Grain Co-op', 'Dinajpur'],
  ['Mizanur Rahman', 'Bogura Fresh Harvest Trust', 'Bogura'],
  ['Shariful Islam', 'Rangpur Root Crop Farmers', 'Rangpur'],
  ['Nasrin Akter', 'Jashore Floral & Produce', 'Jashore'],
  ['Jahangir Alam', 'Munshiganj Potato Guild', 'Munshiganj'],
  ['Rezaul Karim', 'Tangail Mustard & Oil Farm', 'Tangail'],
  ['Farhana Yasmin', 'Sylhet Citrus Collective', 'Sylhet'],
  ['Monirul Haque', 'Mymensingh Dairy & Agro', 'Mymensingh'],
  ['Humayun Kabir', 'Natore Fruit Growers', 'Natore'],
  ['Shamsul Huda', 'Cumilla Vegetable Cooperative', 'Cumilla'],
  ['Laila Begum', 'Sirajganj Milk & Ghee Producers', 'Sirajganj'],
  ['Anisur Rahman', 'Khulna Coastal Agro Farms', 'Khulna'],
  ['Habibur Rahman', 'Naogaon Aromatic Paddy Mill', 'Naogaon'],
  ['Salma Khatun', 'Pabna Fresh Dairy Collective', 'Pabna'],
  ['Ashraful Alam', 'Kushtia Grain & Pulse Hub', 'Kushtia'],
  ['Kamal Hossain', 'Gazipur Hydroponic Greens', 'Gazipur'],
  ['Taslima Begum', 'Barishal River Delta Farms', 'Barishal'],
  ['Mahfuzur Rahman', 'Thakurgaon Orchard & Maize', 'Thakurgaon']
];

const BUYER_NAMES = [
  ['David Chowdhury', 'FreshBasket Supermarkets Chain', 'Tejgaon, Dhaka'],
  ['Nabila Tabassum', 'Bengal Mart Wholesale', 'Gulshan, Dhaka'],
  ['Imran Hossain', 'Chattogram Fresh Grocers', 'Agrabad, Chattogram'],
  ['Sajjad Mahmud', 'Metro Kitchen Supply Co.', 'Dhanmondi, Dhaka'],
  ['Fariha Rahman', 'Sylhet Pantry Retailers', 'Zindabazar, Sylhet'],
  ['Tanvir Ahmed', 'Uttara Organic Grocers', 'Sector 7, Uttara, Dhaka'],
  ['Rashedul Islam', 'Khulna Port Distributors', 'Sonadanga, Khulna'],
  ['Mehedi Hasan', 'Delta Hotel & Catering Supply', 'Banani, Dhaka'],
  ['Nusrat Chowdhury', 'GreenLeaf Consumer Stores', 'Mirpur, Dhaka'],
  ['Asif Iqbal', 'Rajshahi City Provisioners', 'Shaheb Bazar, Rajshahi'],
  ['Sabina Yasmin', 'PureBite Retail Group', 'Bashundhara, Dhaka'],
  ['Arifuzzaman Khan', 'Narayanganj Wholesale Bazaar', 'Chashara, Narayanganj'],
  ['Tarek Aziz', 'Bogura Food Traders', 'Satmatha, Bogura'],
  ['Sumaiya Akter', 'Halal Fresh Supermarket', 'Motijheel, Dhaka'],
  ['Zahidul Islam', 'Coxs Bazar Hospitality Supply', 'Kolatoli, Coxs Bazar'],
  ['Rubaiya Islam', 'Savar Modern Mart', 'Savar, Dhaka'],
  ['Faisal Karim', 'Cumilla Metro Wholesale', 'Kandirpar, Cumilla'],
  ['Nadia Sultana', 'Mymensingh City Mart', 'Ganginarpar, Mymensingh'],
  ['Hasibul Hasan', 'Barishal Agro Distributors', 'Sadar Road, Barishal'],
  ['Shamim Reza', 'Gazipur Industrial Canteens', 'Tongi, Gazipur']
];

export const SEED_FARMERS: UserItem[] = FARMER_NAMES.map(([name, org, region], i) => ({
  id: 200 + i + 1,
  role: 'farmer',
  full_name: name,
  email: `farmer${i + 1}@agrihub.bd`,
  phone: `+880 1711-${String(100001 + i).slice(0, 6)}`,
  business_name: org,
  tax_or_nid_no: `FARM-BD-${4401 + i}`,
  address: `${region} Agricultural Corridor`,
  is_verified: i < 18,
  created_at: `2026-10-${String((i % 25) + 1).padStart(2, '0')} 09:15:00`
}));

export const SEED_BUYERS: UserItem[] = BUYER_NAMES.map(([name, org, addr], i) => ({
  id: 300 + i + 1,
  role: 'buyer',
  full_name: name,
  email: `buyer${i + 1}@agrihub.bd`,
  phone: `+880 1812-${String(200001 + i).slice(0, 6)}`,
  business_name: org,
  tax_or_nid_no: `TRD-BD-${8101 + i}`,
  address: addr,
  is_verified: i < 19,
  created_at: `2026-10-${String((i % 25) + 1).padStart(2, '0')} 11:30:00`
}));

const PRODUCT_TEMPLATES: Array<[string, string, number, number, string, number, boolean]> = [
  ['Grade-A Rajshahi Langra Mangoes', 'Fruits & Berries', 1, 240, 'kg', 4.5, true],
  ['Aromatic Chinigura Kalijira Rice', 'Grains & Cereals', 2, 165, 'kg', 18.0, true],
  ['Chilled Farm-Fresh Whole Milk', 'Dairy & Cold Chain', 3, 95, 'liter', 3.2, false],
  ['Cold-Pressed Virgin Mustard Oil', 'Oils & Seeds', 4, 320, 'liter', 20.0, true],
  ['Bogura Organic Red Tomatoes', 'Vegetables', 5, 85, 'kg', 6.5, true],
  ['Dinajpur Litchi (Bombai Grade-A)', 'Fruits & Berries', 1, 310, 'kg', 4.0, true],
  ['Munshiganj Diamond Potatoes', 'Vegetables', 5, 45, 'kg', 8.0, false],
  ['Sylhet Hatkora & Zara Lemon', 'Fruits & Berries', 1, 190, 'crate', 7.0, true],
  ['Premium Miniket Parboiled Rice', 'Grains & Cereals', 2, 78, 'kg', 20.0, false],
  ['Sirajganj Artisanal Cow Ghee', 'Dairy & Cold Chain', 3, 1150, 'liter', 12.0, true],
  ['Fresh Green Chili (Bogra Grade)', 'Vegetables', 5, 140, 'kg', 6.0, false],
  ['Sun-Dried Sesame Seeds (Til)', 'Oils & Seeds', 4, 225, 'kg', 19.0, true],
  ['Chapainawabganj Himsagar Mangoes', 'Fruits & Berries', 1, 260, 'kg', 4.5, true],
  ['Rangpur Sweet Corn Kernels', 'Grains & Cereals', 2, 65, 'kg', 14.0, false],
  ['Gazipur Hydroponic Baby Spinach', 'Vegetables', 5, 175, 'kg', 3.5, true],
  ['Pabna Pasteurized Fresh Paneer', 'Dairy & Cold Chain', 3, 540, 'kg', 3.0, false],
  ['Tangail Black Mustard Seeds', 'Oils & Seeds', 4, 165, 'kg', 21.0, true],
  ['Barishal Hog Plum (Amra) Crates', 'Fruits & Berries', 1, 135, 'crate', 6.5, false],
  ['Naogaon Aromatic Kataribhog Rice', 'Grains & Cereals', 2, 155, 'kg', 18.0, true],
  ['Jashore Fresh Pointed Gourd (Potol)', 'Vegetables', 5, 72, 'kg', 7.0, true],
  ['Natore Madhupur Honey Pineapple', 'Fruits & Berries', 1, 145, 'kg', 6.0, true],
  ['Kushtia Red Lentil (Moshur Dal)', 'Grains & Cereals', 2, 148, 'kg', 19.0, false],
  ['Cumilla Crisp Green Cabbage', 'Vegetables', 5, 52, 'kg', 4.0, false],
  ['Chilled Cultured Sour Yogurt', 'Dairy & Cold Chain', 3, 180, 'liter', 3.8, true],
  ['Refined Sunflower Seed Oil', 'Oils & Seeds', 4, 285, 'liter', 20.0, false]
];

export const SEED_PRODUCTS: ProductItem[] = Array.from({ length: 50 }, (_, idx) => {
  const tpl = PRODUCT_TEMPLATES[idx % PRODUCT_TEMPLATES.length];
  const farmer = SEED_FARMERS[idx % SEED_FARMERS.length];
  const isSecondWave = idx >= 25;
  const qty = isSecondWave ? 900 + (idx % 12) * 350 : 1400 + (idx % 10) * 480;
  const status: ProductItem['status'] =
    idx % 17 === 0 ? 'low_stock' : idx === 49 ? 'out_of_stock' : 'active';
  const batchPrefix = tpl[1].slice(0, 3).toUpperCase();

  return {
    id: 1001 + idx,
    farmer_id: farmer.id,
    farmerName: `${farmer.full_name} (${farmer.business_name})`,
    farmLocation: farmer.address,
    category: tpl[1],
    category_id: tpl[2],
    title: isSecondWave ? `${tpl[0]} — Reserve Lot` : tpl[0],
    batchNumber: `BATCH-2026-${batchPrefix}-${String(101 + idx)}`,
    harvestDate: `2026-11-${String((idx % 15) + 1).padStart(2, '0')}`,
    expiryDate: tpl[2] === 2 || tpl[2] === 4 ? '2027-08-30' : `2026-12-${String((idx % 20) + 5).padStart(2, '0')}`,
    unitPrice: Math.round(tpl[3] + (isSecondWave ? 10 : 0)),
    unitType: tpl[4],
    quantityAvailable: status === 'out_of_stock' ? 0 : status === 'low_stock' ? 180 : qty,
    storageTempCelsius: tpl[5],
    isOrganic: tpl[6],
    status
  };
});

export const SEED_ORDERS: OrderItem[] = Array.from({ length: 25 }, (_, idx) => {
  const buyer = SEED_BUYERS[idx % SEED_BUYERS.length];
  const prod = SEED_PRODUCTS[idx % SEED_PRODUCTS.length];
  const qty = 150 + (idx % 6) * 80;
  const statuses: OrderItem['orderStatus'][] = ['placed', 'confirmed', 'processing', 'shipped', 'delivered'];
  const orderStatus = statuses[idx % statuses.length];
  const paymentStatus: OrderItem['paymentStatus'] =
    orderStatus === 'delivered' ? 'paid' : orderStatus === 'placed' ? 'pending' : 'escrow_held';

  return {
    id: 500 + idx + 1,
    orderNumber: `AGRI-ORD-2026-${String(101 + idx).padStart(3, '0')}`,
    buyerName: buyer.business_name,
    buyerEmail: buyer.email,
    productTitle: prod.title,
    batchNumber: prod.batchNumber,
    quantity: qty,
    unitType: prod.unitType,
    totalAmount: Math.round(qty * prod.unitPrice),
    paymentStatus,
    orderStatus,
    deliveryAddress: buyer.address,
    createdAt: `2026-11-${String((idx % 18) + 1).padStart(2, '0')} ${String(8 + (idx % 10)).padStart(2, '0')}:25`
  };
});

export const SEED_SHIPMENTS: LogisticsShipment[] = Array.from({ length: 10 }, (_, idx) => {
  const order = SEED_ORDERS[idx];
  const originWarehouse = SEED_WAREHOUSES[(idx + 1) % SEED_WAREHOUSES.length];
  const destWarehouse = SEED_WAREHOUSES[idx % SEED_WAREHOUSES.length];
  const statuses: LogisticsShipment['status'][] = [
    'in_transit',
    'dispatched',
    'arrived',
    'delivered',
    'assigned',
    'in_transit',
    'delayed',
    'dispatched',
    'delivered',
    'in_transit'
  ];
  const status = statuses[idx];
  return {
    id: 700 + idx + 1,
    trackingCode: `TRK-COLD-2026-${8810 + idx}`,
    orderNumber: order.orderNumber,
    product: order.productTitle,
    supplierName: idx % 2 === 0 ? 'AgroCold Logistics Fleet #7' : 'Bengal Reefer Express',
    vehicleNumber: `REEFER-BD-${4401 + idx}`,
    driverName: ['Rafiqul Islam', 'Kamrul Hasan', 'Sohag Mia', 'Tariqul Islam', 'Jewel Rana'][idx % 5],
    driverPhone: `+880 1712-${394850 + idx}`,
    currentTempCelsius: Number((3.6 + (idx % 4) * 0.4).toFixed(1)),
    targetTempCelsius: 5.0,
    originHub: `${originWarehouse.name} (${originWarehouse.region})`,
    destinationHub: `${destWarehouse.name} (${destWarehouse.region})`,
    status,
    eta: status === 'delivered' ? 'Delivered' : `${4 + (idx % 5)} hours`,
    checkpoints: [
      {
        time: '06:30',
        location: `${originWarehouse.region} Collection Hub`,
        note: 'Batch inspected and loaded into pre-cooled unit'
      },
      {
        time: '10:45',
        location: 'Jamuna Bridge Corridor',
        note: `Cold storage steady at ${(3.6 + (idx % 4) * 0.4).toFixed(1)}°C`
      }
    ]
  };
});
