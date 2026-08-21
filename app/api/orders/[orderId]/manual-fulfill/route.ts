import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ orderId: string }> | { orderId: string } }
) {
  try {
    // Safely resolve params across Next.js versions
    const resolvedParams = 'then' in context.params ? await context.params : context.params;
    const orderId = resolvedParams?.orderId;

    if (!orderId) {
      return NextResponse.json(
        { success: false, message: 'Order ID is missing in route parameters.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { courierName, trackingNumber, trackingUrl } = body;

    if (!courierName) {
      return NextResponse.json(
        { success: false, message: 'Courier name is required.' },
        { status: 400 }
      );
    }

    const updateData: Record<string, any> = {
      delivery_partner: courierName,
      courier_name: courierName,
      tracking_number: trackingNumber || null,
      awb_number: trackingNumber || null,
      tracking_url: trackingUrl || null,
      shipment_status: 'SHIPPED',
      order_status: 'IN_TRANSIT',
      shipped_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: updatedOrder, error } = await supabaseAdmin
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Order fulfilled via ${courierName}`,
      order: updatedOrder,
    });
  } catch (error: any) {
    console.error('Manual fulfillment error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}