import { NextResponse } from "next/server";

const BASE_URL = "https://backend.rajkamalprakashan.com/api/v1/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await fetch(`${BASE_URL}/otp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
