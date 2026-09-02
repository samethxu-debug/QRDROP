const recentSecurityEvents = [];
const MAX_STORED_EVENTS = 100;

export function logSecurityEvent({ type, ip, endpoint, details, severity = 'high' }) {
  const event = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: new Date().toISOString(),
    type,
    ip: ip || 'unknown',
    endpoint: endpoint || 'unknown',
    details: details || '',
    severity,
  };

  recentSecurityEvents.unshift(event);
  if (recentSecurityEvents.length > MAX_STORED_EVENTS) {
    recentSecurityEvents.pop();
  }

  console.warn(`[SECURITY_${type.toUpperCase()}] [${event.timestamp}] IP=${event.ip} Endpoint=${event.endpoint} - ${event.details}`);
  return event;
}

export function getRecentSecurityLogs(limit = 50) {
  return recentSecurityEvents.slice(0, limit);
}

export function getSecurityStats() {
  const totalIncidents = recentSecurityEvents.length;
  const byType = {};
  for (const ev of recentSecurityEvents) {
    byType[ev.type] = (byType[ev.type] || 0) + 1;
  }
  return {
    totalIncidents,
    byType,
  };
}
