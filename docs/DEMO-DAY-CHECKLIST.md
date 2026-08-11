# HeatShield AI — Demo Day Readiness Checklist

> **Pre-Presentation Hardware, Software, Network & Credential Checklist**  
> **Date**: August 2026  
> **Status**: APPROVED FOR DEMO DAY  

---

## 1. Hardware & Physical Setup

- [ ] **Laptop Battery**: 100% Fully Charged
- [ ] **Power Adapter**: Laptop charger packed in bag
- [ ] **Display Dongle / Adapter**: HDMI / USB-C adapter verified for presentation projector
- [ ] **Audio / Microphone**: Internal microphone tested for live demo recording
- [ ] **Screen Resolution**: Set display resolution to 1920x1080 for optimal projector display

---

## 2. Software, Server & Environment Setup

- [ ] **Local Dev Server**: Launch `npm run dev` in project terminal (`http://localhost:3000`)
- [ ] **Production URL**: Open Vercel production domain (`https://heatshield-ai.vercel.app`) in secondary browser tab
- [ ] **Browser Window**: Chrome / Edge browser opened in clean session (extensions disabled / Incognito mode)
- [ ] **Internet Connection**: Primary Wi-Fi connected + Mobile Hotspot standby ready
- [ ] **Open-Meteo REST API**: Test endpoint access (`https://api.open-meteo.com/v1/forecast`)
- [ ] **Supabase Cloud Service**: Verify Supabase dashboard connectivity & auth service active
- [ ] **Location Permission**: Browser location permissions pre-approved for `http://localhost:3000`

---

## 3. Demo Accounts & Test Data

- [ ] **Demo User Profile**: Configured profile ready (Adult, High Exertion, Moderate Duration, Limited Cooling)
- [ ] **School Demo Account**: School administrator role credentials verified
- [ ] **Worksite Demo Account**: Worksite manager role credentials verified
- [ ] **Admin Demo Account**: Platform admin role credentials verified

---

## 4. Fallback Assets & Offline Backup

- [ ] **Presentation PDF**: [`docs/FINAL-PRESENTATION.md`](file:///C:/Users/rowad/csp%20%231/docs/FINAL-PRESENTATION.md) / presentation deck open
- [ ] **Paper PDF**: [`docs/HEATSHIELD-AI-IEEE-PAPER.pdf`](file:///C:/Users/rowad/csp%20%231/docs/HEATSHIELD-AI-IEEE-PAPER.pdf) open
- [ ] **Backup Screen Recording**: Recorded MP4 video walkthrough saved on local desktop
- [ ] **Offline Screenshots**: High-resolution UI screenshots saved in `/docs` backup folder

---

## 5. Security & Credential Protection (MANDATORY)

> [!CAUTION]
> **NEVER DISPLAY SENSITIVE CREDENTIALS**: During the live demonstration, ensure terminal windows or open files DO NOT expose:

- [ ] `.env` / `.env.local` configuration files
- [ ] Supabase Service-Role / Master keys
- [ ] Private database connection strings
- [ ] User passwords or authentication tokens
- [ ] JWT secret tokens

---

*Demo Day Readiness Checklist Complete — August 2026*
