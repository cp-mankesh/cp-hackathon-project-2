const GITHUB_TOKEN_PATTERN = /^(ghp_|gho_|github_pat_|ghu_|ghs_|ghr_)/;

export function isPlausibleGitHubToken(token: string | undefined | null): boolean {
  if (!token) return false;
  return GITHUB_TOKEN_PATTERN.test(token) && token.length >= 20;
}

export async function validateGitHubToken(token: string): Promise<{
  valid: boolean;
  login?: string;
  error?: string;
}> {
  if (!isPlausibleGitHubToken(token)) {
    return {
      valid: false,
      error: "GitHub token is missing or invalid. Reconnect GitHub in Settings.",
    };
  }

  try {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "ados-agent",
      },
    });

    if (!res.ok) {
      return {
        valid: false,
        error: `GitHub rejected your token (${res.status}). Reconnect GitHub in Settings.`,
      };
    }

    const user = (await res.json()) as { login?: string };
    return { valid: true, login: user.login };
  } catch {
    return {
      valid: false,
      error: "Could not reach GitHub to verify your token. Check your network and try again.",
    };
  }
}
