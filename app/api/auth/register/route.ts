import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/supabase";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://backend.rajkamalprakashan.com/api/v1/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await fetch(`${BASE_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && body.email && body.password) {
      const admin = createAdminClient();
      const createRes = await admin.auth.admin.createUser({ email: body.email, password: body.password, email_confirm: true });
      if (!createRes.error) {
         const sbClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
         const sbRes = await sbClient.auth.signInWithPassword({ email: body.email, password: body.password });
         if (sbRes.data?.session) {
            data.supabaseSession = sbRes.data.session;
         }
      }
    }

    const response = NextResponse.json(data, { status: res.status });
    const setCookies = res.headers.getSetCookie?.() || [];
    for (const cookie of setCookies) {
      response.headers.append("Set-Cookie", cookie);
    }
    return response;
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
