import { cookies } from "next/headers";

const COOKIE_NAME = "anon_id";
const ONE_YEAR = 60 * 60 * 24 * 365;

// Identificador anónimo por navegador: sustituye al login para separar las conversaciones de cada persona.
export async function getClientId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE_NAME)?.value;
  if (existing) return existing;

  const id = crypto.randomUUID();
  store.set(COOKIE_NAME, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR,
    path: "/",
  });
  return id;
}
