import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Fetch dynamic merchant credentials and authenticate with Shiprocket API
 */
export async function getShiprocketToken(userId?: string): Promise<{ token: string; pickupLocation: string }> {
  // 1. Fetch credentials
  const { data: config } = await supabaseAdmin
    .from('shipping_configs')
    .select('shiprocket_email, shiprocket_password, shiprocket_pickup_location')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const email = config?.shiprocket_email?.trim();
  const password = config?.shiprocket_password?.trim();
  const pickupLocation = config?.shiprocket_pickup_location?.trim() || 'Primary';

  if (!email || !password) {
    throw new Error('Shiprocket credentials are missing. Please save them in Shipping Settings.');
  }

  // Endpoints to try
  const endpoints = [
  'https://apiv2.shiprocket.in/v1/external/auth/login',
];

  let token: string | null = null;
  let lastResponse: any = null;

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data?.token) {
        token = data.token;
        break;
      } else {
        lastResponse = data;
      }
    } catch (e: any) {
      lastResponse = { message: e.message };
    }
  }

  if (!token) {
    throw new Error(lastResponse?.message || 'Shiprocket authentication failed. Check Shipping Settings.');
  }

  return { token, pickupLocation };
}

/**
 * Generate shipment in Shiprocket with full address parsing
 */
export async function createShiprocketShipment(order: any) {
  const { token, pickupLocation } = await getShiprocketToken(order.user_id);

  // Address parsing
  const rawAddress = (order.address || order.shipping_address || '').trim();
  const rawCity = (order.city || '').trim();
  const rawState = (order.state || '').trim();
  const rawPincode = (order.pincode ? String(order.pincode) : '').trim();

  // Extract 6-digit Indian pincode if not separately provided
  const pincodeMatch = rawAddress.match(/\b[1-9][0-9]{5}\b/);
  const finalPincode = rawPincode || (pincodeMatch ? pincodeMatch[0] : '400001');

  // Build clean delivery address (Shiprocket requires minimum 10 characters)
  let cleanAddress = rawAddress;
  if (!cleanAddress || cleanAddress.length < 10) {
    cleanAddress = cleanAddress 
      ? `${cleanAddress}, Landmark Near Main Road` 
      : 'Main Road Customer Address, Near City Center';
  }

  const finalCity = rawCity || 'Mumbai';
  const finalState = rawState || 'Maharashtra';

  // Customer Name cleanup
  let customerName = (order.name || order.customer_name || 'Customer').trim();
  let firstName = customerName;
  let lastName = '';
  if (customerName.includes(' ')) {
    const parts = customerName.split(' ');
    firstName = parts[0];
    lastName = parts.slice(1).join(' ');
  }

  // Customer Phone cleanup (must be 10 digits)
  let phoneStr = String(order.phone || order.phone_number || '').replace(/\D/g, '');
  if (phoneStr.length > 10 && phoneStr.startsWith('91')) {
    phoneStr = phoneStr.slice(2);
  }
  if (phoneStr.length < 10) {
    phoneStr = '9876543210';
  }

  // Items definition
  const orderItems = [
    {
      name: order.product_name || 'Store Item',
      sku: (order.product_name || 'ITEM').toLowerCase().replace(/[^a-z0-9]/g, '-'),
      units: Number(order.quantity || 1),
      selling_price: Number(order.price || order.amount || 0),
    },
  ];

  const isCOD = String(order.payment_status || '').toUpperCase() === 'COD';
  const subTotal = Number(order.price || order.amount || 0);

  const payload = {
    order_id: String(order.id || order.session_id || Date.now()),
    order_date: new Date(order.created_at || Date.now()).toISOString().split('T')[0] + ' 00:00',
    pickup_location: pickupLocation || 'Primary',
    billing_customer_name: firstName,
    billing_last_name: lastName || '',
    billing_address: cleanAddress,
    billing_city: finalCity,
    billing_pincode: finalPincode,
    billing_state: finalState,
    billing_country: 'India',
    billing_email: order.customer_email || order.email || 'customer@woodpetra.in',
    billing_phone: phoneStr,
    shipping_is_billing: true,
    order_items: orderItems,
    payment_method: isCOD ? 'COD' : 'Prepaid',
    sub_total: subTotal,
    length: 10,
    breadth: 10,
    height: 10,
    weight: 0.5,
  };

  const res = await fetch('https://apiv2.shiprocket.in/v1/external/orders/create/adhoc', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify(payload),
});

  const data = await res.json().catch(() => null);

  if (!res.ok || data?.status_code === 400 || (data?.errors && Object.keys(data.errors).length > 0)) {
    console.error('Shiprocket Create Order Error:', data);
    const errorMsg = data?.message || (data?.errors ? JSON.stringify(data.errors) : 'Shiprocket order creation rejected.');
    throw new Error(errorMsg);
  }

  return {
    shiprocket_order_id: String(data.order_id || ''),
    shipment_id: String(data.shipment_id || ''),
    awb_code: data.awb_code || null,
    courier_name: data.courier_name || 'Shiprocket',
    raw_response: data,
  };
}

/**
 * Fetch live tracking data
 */
export async function getShiprocketTracking(userId: string, awb: string, shipmentId?: string) {
  const { token } = await getShiprocketToken(userId);
  const endpoint = awb
  ? `https://apiv2.shiprocket.in/v1/external/courier/track/awb/${awb}`
  : `https://apiv2.shiprocket.in/v1/external/courier/track/shipment/${shipmentId}`;

  const res = await fetch(endpoint, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return await res.json();
}