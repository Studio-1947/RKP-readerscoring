import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/server/supabase";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const BASE_URL = "https://backend.rajkamalprakashan.com/api/v1/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await fetch(`${BASE_URL}/otp/verify`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "User-Agent": request.headers.get("user-agent") || "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "application/json"
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    
    if (res.ok && (body.phone || body.email)) {
      const identifier = body.phone || body.email;
      const deterministicPassword = crypto.createHash("sha256").update(identifier + process.env.SUPABASE_SERVICE_ROLE_KEY).digest("hex");
      
      const admin = createAdminClient();
      const sbClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      
      let sbRes = await sbClient.auth.signInWithPassword({ 
         ...(body.email ? { email: body.email } : { phone: body.phone }), 
         password: deterministicPassword 
      });

      if (sbRes.error) {
         let query = admin.from("reader_profiles").select("id");
         if (body.email) query = query.eq("email", body.email);
         else query = query.eq("phone", body.phone);
         
         const { data: profile } = await query.single();
         
         if (profile?.id) {
            await admin.auth.admin.updateUserById(profile.id, { password: deterministicPassword });
            sbRes = await sbClient.auth.signInWithPassword({ 
               ...(body.email ? { email: body.email } : { phone: body.phone }), 
               password: deterministicPassword 
            });
         } else {
            const createRes = await admin.auth.admin.createUser({ 
               ...(body.email ? { email: body.email, email_confirm: true } : { phone: body.phone, phone_confirm: true }), 
               password: deterministicPassword 
            });
            if (!createRes.error) {
               sbRes = await sbClient.auth.signInWithPassword({ 
                  ...(body.email ? { email: body.email } : { phone: body.phone }), 
                  password: deterministicPassword 
               });
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
