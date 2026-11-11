const BASE_URL = (process.env.REACT_APP_API_ENDPOINT || '').replace(/\/$/, '');

export async function fetchServerInfoApi(): Promise<string> {
  if (!BASE_URL) {
    throw new Error('API endpoint is not configured');
  }

  const response = await fetch(`${BASE_URL}/merchants-info`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    let message = 'Failed to fetch server info';
    try {
      message = JSON.parse(text)?.message || message;
    } catch {
      // Ignore non-JSON error bodies
    }
    throw new Error(message);
  }

  const json = await response.json();
  const serverKnownSalt = json?.value;

  if (!serverKnownSalt || typeof serverKnownSalt !== 'string') {
    throw new Error('Server known salt is missing');
  }

  return serverKnownSalt;
}
