import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const EmailSchema = z.object({
  ownerToken: z.string().min(1),
  email: z.string().email(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  const parsed = EmailSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid email", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { ownerToken, email } = parsed.data;

  const { error } = await supabase
    .from("users")
    .upsert(
      { owner_token: ownerToken, email },
      { onConflict: "owner_token" }
    );

  if (error) {
    console.error("[email] DB error:", error);
    return Response.json({ error: "Failed to save email" }, { status: 500 });
  }

  return Response.json({ success: true });
}
