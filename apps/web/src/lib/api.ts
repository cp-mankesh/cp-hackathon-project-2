export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4020";

export async function api<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const hasBody = options?.body !== undefined && options?.body !== null;
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (hasBody && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(
      (err as { error?: string; message?: string }).error ??
        (err as { message?: string }).message ??
        "Request failed"
    );
  }
  return res.json() as Promise<T>;
}
