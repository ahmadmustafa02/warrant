const NETWORK_COMMAND =
  /\b(curl|wget|Invoke-WebRequest|iwr\b|nc\s|nmap\s|ssh\s[^\s]+@)/i;

const URL_CAPTURE = /\b(https?:\/\/[^\s"'<>]+)/i;
const HOST_CAPTURE =
  /\b(?:curl|wget)\s+[^\s]*?(https?:\/\/[^\s"'<>]+|[\w.-]+\.[a-z]{2,}(?:\/[^\s"'<>]*)?)/i;

export function shellCommandLooksLikeNetworkEgress(command: string): boolean {
  return NETWORK_COMMAND.test(command);
}

export function extractNetworkTarget(command: string): string {
  const url = command.match(URL_CAPTURE)?.[1];
  if (url !== undefined) {
    return url;
  }
  const host = command.match(HOST_CAPTURE)?.[1];
  if (host !== undefined) {
    return host;
  }
  return command.trim().slice(0, 200);
}
