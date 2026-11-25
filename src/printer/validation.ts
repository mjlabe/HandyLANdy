import type { PrinterProfile } from './types';

export type ProfileInput = Omit<PrinterProfile, 'id'>;

/** Credentials remain separate from persisted profile metadata. */
export function validateProfile(profile: ProfileInput, accessCode: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!profile.name.trim() || profile.name.length > 80) errors.name = 'Enter a printer name (up to 80 characters).';
  const host = profile.host.trim();
  const ipv4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.test(host);
  const hostname = /^(?=.{1,253}$)[a-z\d](?:[a-z\d.-]*[a-z\d])?$/i.test(host) && host.split('.').every((part) => part.length <= 63 && !part.startsWith('-') && !part.endsWith('-'));
  if (!hostname || (ipv4 && host.split('.').some((part) => Number(part) > 255))) errors.host = 'Enter a printer IP address or local hostname without a URL or port.';
  if (!/^[a-z\d_-]{5,64}$/i.test(profile.serial.trim())) errors.serial = 'Enter the serial number printed on the printer.';
  if (!profile.model.trim()) errors.model = 'Select a printer model.';
  if (profile.cameraProtocol !== 'jpeg' && profile.cameraProtocol !== 'rtsps') errors.cameraProtocol = 'Select a supported camera protocol.';
  if (!/^[\x21-\x7e]{1,32}$/.test(accessCode)) errors.accessCode = 'Enter the LAN access code (up to 32 characters, without spaces).';
  return errors;
}
