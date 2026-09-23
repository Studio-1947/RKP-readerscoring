export async function GET(request: Request) {
  const token = process.env.HEALTHCHECK_TOKEN;
  if (!token || request.headers.get("authorization") !== `Bearer ${token}`) {
    return new Response(null, { status: 404 });
  }
  return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}


