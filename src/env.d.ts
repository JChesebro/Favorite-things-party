interface ImportMetaEnv {
	readonly VITE_SUPABASE_URL?: string
	readonly VITE_SUPABASE_ANON_KEY?: string
	readonly VITE_SUPABASE_INVITES_TABLE?: string
	readonly VITE_SUPABASE_GALLERY_TABLE?: string
	readonly VITE_HOST_VIEW_CODE?: string
	readonly [key: string]: string | undefined
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}
