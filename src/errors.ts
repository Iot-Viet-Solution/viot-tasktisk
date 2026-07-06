interface NodeErrorCause {
  code?: string;
  hostname?: string;
}

/** Turns raw Node/fetch errors (DNS failures, refused connections, timeouts) into
 * actionable messages instead of a bare `TypeError: fetch failed` + cause dump. */
export function formatError(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as Error & { cause?: unknown }).cause as NodeErrorCause | undefined;
    switch (cause?.code) {
      case 'EAI_AGAIN':
      case 'ENOTFOUND':
        return `Could not resolve host${cause.hostname ? ` "${cause.hostname}"` : ''} — ` +
          'check the url in your config (run `viot-tasktisk setup` to fix it).';
      case 'ECONNREFUSED':
        return 'Connection refused — is the QLDA server running and reachable at that url?';
      case 'ETIMEDOUT':
      case 'UND_ERR_CONNECT_TIMEOUT':
        return 'Connection timed out — check the url in your config and your network.';
    }
    return err.message;
  }
  return String(err);
}
