import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createShiprocketShipment } from '@/lib/integrations/shiprocket';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(
  req: NextRequest,
  context: { params: { orderId: string } | Promise<{ orderId: string }> }
) {
  try {
    let orderIdentifier: string | undefined;

    if (context?.params) {
      const p = 'then' in context.params ? await context.params : context.params;
      orderIdentifier = p?.orderId;
    }

    if (!orderIdentifier) {
      const segments = req.nextUrl.pathname.split('/');
      orderIdentifier = segments[segments.length - 2];
    }

    if (!orderIdentifier) {
      return NextResponse.json({ success: false, message: 'Order ID is missing.' }, { status: 400 });
    }

    // 1. Fetch order details from Supabase
    let { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderIdentifier)
      .maybeSingle();

    if (!order) {
      const { data: altOrder } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('session_id', orderIdentifier)
        .limit(1)
        .maybeSingle();

      order = altOrder;
    }

    if (!order) {
      return NextResponse.json({ success: false, message: 'Order not found in database.' }, { status: 404 });
    }

    // 2. Trigger Shiprocket shipment creation
    const result = await createShiprocketShipment(order);
    const trackingCode = result.awb_code || result.shipment_id || result.shiprocket_order_id || 'PENDING';

    // 3. Update only verified existing schema columns
    const { data: updatedOrder, error: updateErr } = await supabaseAdmin
      .from('orders')
      .update({
        delivery_partner: 'Shiprocket',
        shipment_id: String(result.shipment_id || ''),
        awb_number: result.awb_code ? String(result.awb_code) : String(trackingCode),
        tracking_number: String(trackingCode),
        courier_name: result.courier_name || 'Shiprocket',
        shipment_status: 'Shipment Created',
        shipped_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .select()
      .single();

    if (updateErr) {
      console.error('[Supabase Order Update Error]:', updateErr);
      return NextResponse.json({ success: false, message: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Shipment created successfully!',
      shipment: result,
      order: updatedOrder,
    });
  } catch (error: any) {
    console.error('[Shiprocket Route Error]:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Shiprocket fulfillment error.' },
      { status: 500 }
    );
  }
}