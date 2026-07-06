# Glacier Soiree

A Netlify-ready party website for Stephanie and Jeff's annual Favorite Things party.

## Features

- Glacier Soiree theme with blues, golds, and champagne
- Editable guest invites with invite-code loading
- Plus-one count and food contribution fields
- Shared guest board so everyone can see who is coming and what they are bringing
- Icebreaker and trivia answer walls
- Favorite-things guessing game and party-game planning ideas
- Polaroid photo booth and shared gallery

## Scripts

- `npm run dev`
- `npm run build`
- `npm run preview`

## Shared backend setup

The app uses a Supabase-compatible backend for shared invites and gallery items. Copy [.env.example](/Users/Steph/Documents/favorite-things-party/.env.example) to `.env.local` and fill in your project values.

Required environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_INVITES_TABLE`
- `VITE_SUPABASE_GALLERY_TABLE`
- `VITE_HOST_VIEW_CODE`

Use [supabase-schema.sql](/Users/Steph/Documents/favorite-things-party/supabase-schema.sql) to create the `guest_invites` and `gallery_entries` tables.

## Notes

- If the backend variables are not set, the site falls back to preview data so you can keep working locally.
- Invite edits are saved by code so guests can reopen and update their own record later.
- The live guest board and gallery will update automatically after you set the Supabase variables in Netlify.
- Host view requires the host code and supports guest, host, and split board previews.
