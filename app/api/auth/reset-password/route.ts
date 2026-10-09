import { NextResponse } from "next/server";

const BASE_URL = "https://backend.rajkamalprakashan.com/api/v1/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await fetch(`${BASE_URL}/reset-password`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "User-Agent": request.headers.get("user-agent") || "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "application/json"
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
