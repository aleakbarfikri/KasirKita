import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ ok: false, error: { message, details } }, { status });
}

export async function readJson<T = unknown>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

export async function readLimitedJson<T = unknown>(request: Request, maxBytes: number): Promise<T> {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    throw Object.assign(new Error("Content-Type harus application/json."), { status: 415 });
  }
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > maxBytes) throw Object.assign(new Error("Ukuran request terlalu besar."), { status: 413 });
  if (!request.body) return {} as T;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        throw Object.assign(new Error("Ukuran request terlalu besar."), { status: 413 });
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch (error) {
    if (typeof (error as { status?: unknown })?.status === "number") throw error;
    throw Object.assign(new Error("Data JSON tidak valid."), { status: 400 });
  }
}
