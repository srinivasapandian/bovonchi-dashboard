import axios from 'axios';

export interface AxiosFetchInit extends RequestInit {
  onUploadProgress?: (event: any) => void;
}

/**
 * Axios-backed drop-in replacement for fetch().
 * Returns a standard Response so all existing service files work unchanged.
 * Uses validateStatus: () => true so non-2xx responses are NOT thrown as errors
 * (same behaviour as native fetch — callers check response.ok themselves).
 */
export async function axiosFetch(
  input: RequestInfo | URL,
  init?: AxiosFetchInit
): Promise<Response> {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
      ? input.href
      : (input as Request).url;

  const axiosResponse = await axios({
    method: (init?.method ?? 'GET') as any,
    url,
    headers: init?.headers as Record<string, string> | undefined,
    data: init?.body,
    onUploadProgress: init?.onUploadProgress,
    validateStatus: () => true,
    responseType: 'text',
  });

  const body =
    typeof axiosResponse.data === 'string'
      ? axiosResponse.data
      : JSON.stringify(axiosResponse.data);

  return new Response(body, {
    status: axiosResponse.status,
    statusText: axiosResponse.statusText,
    headers: new Headers(
      axiosResponse.headers as Record<string, string>
    ),
  });
}
