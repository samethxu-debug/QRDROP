// Centralized safe fetch helper that prevents 'Unexpected end of JSON input' errors
export async function safeFetchJson(url, options = {}) {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    
    let data = {};
    const text = await res.text();

    if (text && text.trim().length > 0) {
      if (contentType.includes('application/json') || text.startsWith('{') || text.startsWith('[')) {
        try {
          data = JSON.parse(text);
        } catch (parseErr) {
          data = { error: text || 'Invalid JSON response from server' };
        }
      } else {
        data = { message: text, raw: text };
      }
    }

    if (!res.ok) {
      const errorMsg = data.error || data.message || `Request failed with status ${res.status}`;
      return {
        ok: false,
        status: res.status,
        data,
        error: errorMsg,
        res,
      };
    }

    return {
      ok: true,
      status: res.status,
      data,
      error: null,
      res,
    };
  } catch (netErr) {
    return {
      ok: false,
      status: 0,
      data: {},
      error: netErr.message || 'Network connection failed. Please check your connection.',
      res: null,
    };
  }
}
