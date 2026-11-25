const messages = {
  certificate:
    'Printer certificate could not be verified. If this is your printer, enable “Allow printer self-signed certificate” in its profile.',
  refused: 'Printer refused the MQTT connection on port 8883. Check that LAN access is enabled.',
  unreachable:
    'Printer address is unreachable. Check its IP address and your local network connection.',
  permission:
    'Network access was denied. Check HandyLANdy’s local network permission in system settings.',
  timeout: 'Timed out connecting to the printer on port 8883.',
  authentication:
    'Printer rejected MQTT authentication. Check its LAN access code and Developer Mode setting.',
  connection: 'MQTT connection failed before a status report arrived. Try reconnecting.',
  startup: 'MQTT client could not initialize. Restart the app and try reconnecting.',
} as const;

type ConnectionFailure = keyof typeof messages;

export class PrinterConnectionError extends Error {
  constructor(readonly reason: ConnectionFailure) {
    super(messages[reason]);
    this.name = 'PrinterConnectionError';
  }
}

/** Native errors can contain credentials. Return only fixed, recognized diagnoses. */
export function connectionError(
  error: unknown,
  fallback: ConnectionFailure = 'connection',
): PrinterConnectionError {
  if (error instanceof PrinterConnectionError) return new PrinterConnectionError(error.reason);
  const value =
    error && typeof error === 'object'
      ? (error as { code?: unknown; message?: unknown })
      : undefined;
  const code = value?.code;
  const message =
    typeof error === 'string' ? error : typeof value?.message === 'string' ? value.message : '';
  const detail = `${typeof code === 'string' ? code : ''} ${message.slice(0, 1024)}`;
  if (code === 4 || code === 5) return new PrinterConnectionError('authentication');
  if (/CERT_|SELF_SIGNED|certificate|unknown ca|trust evaluation/i.test(detail))
    return new PrinterConnectionError('certificate');
  if (/ECONNREFUSED|connection refused/i.test(detail)) return new PrinterConnectionError('refused');
  if (
    /EHOSTUNREACH|ENETUNREACH|ENOTFOUND|EAI_AGAIN|no route to host|host.*not found|network is unreachable/i.test(
      detail,
    )
  )
    return new PrinterConnectionError('unreachable');
  if (/EACCES|EPERM|permission denied|operation not permitted|local network.*denied/i.test(detail))
    return new PrinterConnectionError('permission');
  if (/ETIMEDOUT|timed out|timeout/i.test(detail)) return new PrinterConnectionError('timeout');
  return new PrinterConnectionError(fallback);
}
