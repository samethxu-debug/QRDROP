import os from 'os';

/**
 * Returns the primary local IPv4 address of this machine (e.g. 192.168.x.x)
 * so that other devices (like smartphones on the same Wi-Fi) can access the server.
 */
export function getLocalIpAddress() {
  const nets = os.networkInterfaces();
  // Prioritize Wi-Fi or Ethernet interfaces
  const preferredInterfaces = ['Wi-Fi', 'WiFi', 'Ethernet', 'eth0', 'wlan0', 'en0'];
  
  for (const preferred of preferredInterfaces) {
    if (nets[preferred]) {
      for (const net of nets[preferred]) {
        const isV4 = net.family === 'IPv4' || net.family === 4;
        if (isV4 && !net.internal) {
          return net.address;
        }
      }
    }
  }

  // Fallback to any active non-internal IPv4
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      const isV4 = net.family === 'IPv4' || net.family === 4;
      if (isV4 && !net.internal) {
        return net.address;
      }
    }
  }

  return 'localhost';
}
