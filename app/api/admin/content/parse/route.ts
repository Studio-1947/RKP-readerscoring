import { requireAdmin } from "@/lib/server/admin";
import mammoth from "mammoth";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth) return Response.json({ error: "Admin access is required." }, { status: 403 });

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return Response.json({ error: "No file uploaded." }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const name = file.name.toLowerCase();
    
    let text = "";
    if (name.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (name.endsWith(".txt") || name.endsWith(".csv")) {
      text = buffer.toString("utf-8");
    } else {
      return Response.json({ error: "Unsupported file type. Please upload .docx, .txt, or .csv" }, { status: 415 });
    }

    return Response.json({ ok: true, text });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Failed to parse file." }, { status: 500 });
  }
}
