/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_ENDPOINT: string;
  readonly VITE_API_ENDPOINT_REVAMP: string;
  readonly VITE_E_KEY: string;
  readonly VITE_IMAGE_URL: string;
  readonly VITE_BRAND_NAME?: string;
  /** Dev only: serve the Orders screen from local fixtures instead of the API. */
  readonly VITE_MOCK_ORDERS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
