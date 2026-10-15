/// <reference types="vite/client" />

/** Version de package.json, injectée par `define` dans vite.config.ts. */
declare const __APP_VERSION__: string

declare module '*.module.scss' {
  const classes: { readonly [key: string]: string }
  export default classes
}

interface ImportMetaEnv {
  readonly VITE_SOCKET_URL?: string
  // Ajoutez d'autres variables d'environnement ici si nécessaire
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
