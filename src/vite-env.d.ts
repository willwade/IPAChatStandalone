/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AZURE_KEY?: string;
  readonly VITE_AZURE_REGION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
