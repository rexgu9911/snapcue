interface ImportMetaEnv {
  readonly SNAPCUE_API_URL: string
  readonly SNAPCUE_API_KEY: string
  readonly SNAPCUE_SUPABASE_URL: string
  readonly SNAPCUE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
