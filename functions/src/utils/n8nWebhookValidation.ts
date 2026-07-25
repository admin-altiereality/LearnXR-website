const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^0\./,
  /^localhost$/i,
];

function getAllowedWebhookHosts(): Set<string> {
  const hosts = new Set<string>();
  for (const envKey of ['N8N_WEBHOOK_BASE', 'N8N_API_URL', 'N8N_WEBHOOK_URL']) {
    const raw = process.env[envKey];
    if (!raw) continue;
    try {
      hosts.add(new URL(raw).hostname.toLowerCase());
    } catch {
      // ignore invalid env values
    }
  }
  return hosts;
}

export function resolveAllowedN8nWebhookUrl(clientUrl?: string): string | null {
  const allowedHosts = getAllowedWebhookHosts();
  if (allowedHosts.size === 0) return null;

  const configured = [...allowedHosts]
    .map((host) => {
      for (const envKey of ['N8N_WEBHOOK_BASE', 'N8N_WEBHOOK_URL', 'N8N_API_URL']) {
        const raw = process.env[envKey];
        if (!raw) continue;
        try {
          const parsed = new URL(raw);
          if (parsed.hostname.toLowerCase() === host) {
            return parsed.origin + parsed.pathname.replace(/\/$/, '');
          }
        } catch {
          // ignore
        }
      }
      return null;
    })
    .find(Boolean);

  if (clientUrl && typeof clientUrl === 'string' && clientUrl.trim()) {
    try {
      const parsed = new URL(clientUrl.trim());
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
      const hostname = parsed.hostname.toLowerCase();
      if (!allowedHosts.has(hostname)) return null;
      if (PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(hostname))) return null;
      return parsed.toString();
    } catch {
      return null;
    }
  }

  return configured ?? null;
}
