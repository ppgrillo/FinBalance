# Netlify Environment Variables Setup Guide

To ensure your application works correctly on Netlify, you need to configure the following environment variables in your site settings.

## Required Variables

| Key | Description |
| --- | --- |
| `VITE_SUPABASE_URL` | Your Supabase Project URL (e.g., `https://xyz.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase Anon Key (public API key) |
| `VITE_GEMINI_API_KEY` | Your Google Gemini API Key |

## How to Add Variables in Netlify

1.  Go to your **Netlify Dashboard** and select your site.
2.  Navigate to **Site configuration** > **Environment variables**.
3.  Click on **Add a variable**.
4.  Select **Add a single variable** (or import from .env if you have one locally, but manual is safer).
5.  Enter the **Key** (e.g., `VITE_SUPABASE_URL`) and the **Value**.
6.  Repeat for all required variables.
7.  **Trigger a new deploy** (if the build failed previously or to apply changes).

> [!IMPORTANT]
> Ensure that the keys start with `VITE_` so that they are exposed to your React application during the build process.
