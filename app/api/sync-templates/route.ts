import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  try {
    // Fetch WhatsApp configuration
    const { data: config, error: configError } = await supabase
      .from("whatsapp_configs")
      .select("id, whatsapp_access_token, waba_id")
      .not("whatsapp_access_token", "is", null)
      .not("waba_id", "is", null)
      .limit(1)
      .single();

    if (configError || !config) {
      return NextResponse.json(
        {
          error: "WhatsApp configuration not found",
        },
        { status: 404 }
      );
    }

    const metaResponse = await fetch(
      `https://graph.facebook.com/v21.0/${config.waba_id}/message_templates?limit=1000`,
      {
        headers: {
          Authorization: `Bearer ${config.whatsapp_access_token}`,
        },
      }
    );

    const metaData = await metaResponse.json();

    console.log(metaData);

    if (!metaResponse.ok) {
      return NextResponse.json(metaData, {
        status: metaResponse.status,
      });
    }

    const templatesToSync = metaData.data.map((template: any) => {
      const header = template.components?.find(
        (c: any) => c.type === "HEADER"
      );

      const body = template.components?.find(
        (c: any) => c.type === "BODY"
      );

      const footer = template.components?.find(
        (c: any) => c.type === "FOOTER"
      );

      const buttons = template.components?.find(
        (c: any) => c.type === "BUTTONS"
      );

      return {
        whatsapp_config_id: config.id,

        meta_template_id: template.id,

        name: template.name,

        category: template.category,

        language: template.language,

        status: template.status,

        header_type: header?.format ?? null,

        header_content: header?.text ?? null,

        body: body?.text ?? null,

        footer: footer?.text ?? null,

        buttons: buttons?.buttons ?? [],

        updated_at: new Date().toISOString(),
      };
    });

    const { error: upsertError } = await supabase
      .from("whatsapp_templates")
      .upsert(templatesToSync, {
        onConflict: "whatsapp_config_id,meta_template_id",
      });

    if (upsertError) {
      console.error(upsertError);

      return NextResponse.json(
        {
          error: upsertError.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
      synced: templatesToSync.length,
    });
  } catch (err: any) {
    console.error(err);

    return NextResponse.json(
      {
        error: err.message,
      },
      {
        status: 500,
      }
    );
  }
}