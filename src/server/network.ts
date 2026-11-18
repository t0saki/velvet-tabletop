import os from 'node:os';
import QRCode from 'qrcode';
import type { LanNetworkInfo } from '../shared/types.js';

function isContainerBridge(name: string): boolean {
  return /^(docker\d*|br-[0-9a-f]+|veth|virbr|cni)/i.test(name);
}

function scoreLanInterface(name: string, ip: string): number {
  let score = 0;
  if (name.startsWith('en0')) score += 50;
  else if (name.startsWith('en1')) score += 40;
  else if (name.startsWith('wlan') || name.startsWith('eth')) score += 35;

  if (ip.startsWith('192.168.')) score += 40;
  else if (ip.startsWith('10.')) score += 30;
  else if (ip.startsWith('172.')) score += 20;

  // Penalize common VPN/virtual bridge interfaces
  if (/utun|tun|tap|bridge|docker|veth|vmnet/i.test(name)) score -= 80;
  return score;
}

export function getLanNetworkInfo(port: number): LanNetworkInfo {
  const interfaces = os.networkInterfaces();
  const rawCandidates: Array<{ name: string; ip: string; score: number }> = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        rawCandidates.push({
          name,
          ip: addr.address,
          score: scoreLanInterface(name, addr.address),
        });
      }
    }
  }

  const nonContainer = rawCandidates.filter((c) => !isContainerBridge(c.name));
  const candidates = nonContainer.length > 0 ? nonContainer : rawCandidates;

  candidates.sort((a, b) => b.score - a.score);

  const addresses = candidates.map((c) => ({
    name: c.name,
    ip: c.ip,
    url: `http://${c.ip}:${port}`,
  }));

  if (addresses.length === 0) {
    addresses.push({
      name: 'localhost',
      ip: '127.0.0.1',
      url: `http://127.0.0.1:${port}`,
    });
  }

  return {
    port,
    addresses,
    primaryUrl: addresses[0].url,
  };
}

export async function generateQrDataUrl(targetUrl: string): Promise<string> {
  return QRCode.toDataURL(targetUrl, {
    width: 360,
    margin: 2,
    color: {
      dark: '#0B0D13',
      light: '#FBF8F1',
    },
  });
}
