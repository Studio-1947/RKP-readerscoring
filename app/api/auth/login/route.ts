import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/supabase";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://backend.rajkamalprakashan.com/api/v1/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await fetch(`${BASE_URL}/login`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "User-Agent": request.headers.get("user-agent") || "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "application/json"
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && body.email && body.password) {
      const sbClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      let sbRes = await sbClient.auth.signInWithPassword({ email: body.email, password: body.password });

      if (sbRes.error) {
        const admin = createAdminClient();
        const { data: profile } = await admin.from("reader_profiles").select("id").eq("email", body.email).single();
        if (profile?.id) {
           await admin.auth.admin.updateUserById(profile.id, { password: body.password });
           sbRes = await sbClient.auth.signInWithPassword({ email: body.email, password: body.password });
        } else {
           const createRes = await admin.auth.admin.createUser({ email: body.email, password: body.password, email_confirm: true });
           if (!createRes.error) {
              sbRes = await sbClient.auth.signInWithPassword({ email: body.email, password: body.password });
           }
        }
      }
      
      if (sbRes.data?.session) {
        data.supabaseSession = sbRes.data.session;
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
