import { describe, expect, it } from "vitest";

const API_URL = process.env.API_URL ?? "http://localhost:4020";
const WEB_URL = process.env.WEB_URL ?? "http://localhost:3020";

async function fetchJson(path: string, init?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, init);
  return { status: res.status, body: await res.json().catch(() => null) };
}

describe("live smoke tests", () => {
  it("API health endpoint is reachable", async () => {
    const { status, body } = await fetchJson("/api/health");
    expect(status).toBe(200);
    expect(body).toEqual({ status: "ok", service: "ados-api" });
  });

  it("public projects endpoint is reachable", async () => {
    const { status, body } = await fetchJson("/api/projects/public");
    expect(status).toBe(200);
    expect(body).toHaveProperty("projects");
  });

  it("web landing page loads", async () => {
    const res = await fetch(WEB_URL);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("AI Engineer Hub");
  });

  it("dev login flow works on live API", async () => {
    const loginRes = await fetch(`${API_URL}/api/auth/dev-login`, { method: "POST" });
    expect(loginRes.status).toBe(200);
    const cookie = loginRes.headers.get("set-cookie");
    expect(cookie).toContain("ados_session");

    const meRes = await fetch(`${API_URL}/api/auth/me`, {
      headers: { cookie: cookie ?? "" },
    });
    expect(meRes.status).toBe(200);
    const me = (await meRes.json()) as { user: { email: string } };
    expect(me.user.email).toBeTruthy();
  });
});
