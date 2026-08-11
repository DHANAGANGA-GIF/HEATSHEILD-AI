# Security & Access Control — HEATSHIELD AI

## 1. Authentication & Authorization
- **Auth Provider:** Supabase Auth (Google OAuth 2.0).
- **Role-Based Access Control (RBAC):** `user`, `school`, `worksite`, `ngo`, `admin`.
- **Row-Level Security (RLS):** Policies enforced on `public.profiles`, `public.incidents`, and `public.notifications` to isolate tenant data.

## 2. API & Secret Management
- Secrets are stored in `.env.local` using standard Next.js environment variables.
- Public variables prefixed with `NEXT_PUBLIC_`.
- Input validation & sanitation on forms to prevent XSS and SQL injection.
