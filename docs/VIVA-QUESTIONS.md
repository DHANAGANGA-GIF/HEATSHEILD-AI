# HeatShield AI — Comprehensive Viva & Oral Examination Guide

> 50 Detailed Questions & Concise Technical Answers for Project Viva Defense

---

## Category 1: Problem Statement & Domain

### Q1. What is the core problem HeatShield AI solves?
**Answer**: HeatShield AI solves the contextual heat-risk evaluation gap. Generic weather apps provide ambient temperature (e.g. 38°C) without considering personal activity exertion, exposure duration, cooling availability, or institutional operational rules.

### Q2. Is HeatShield AI a medical diagnosis system?
**Answer**: **No.** HeatShield AI is strictly an environmental decision-support tool. It provides non-clinical environmental risk estimates and operational safety guidance. It does NOT diagnose medical conditions or prescribe treatments.

### Q3. Can the ML model predict whether an individual will suffer a heatstroke?
**Answer**: **No.** Heatstroke is a complex clinical emergency depending on individual metabolic, vascular, and physiological factors. The model predicts environmental heat-risk levels (LOW to EXTREME) to encourage preventive action, not clinical events.

### Q4. What is the target audience for HeatShield AI?
**Answer**: Individuals (outdoor workers, athletes, elderly), institutional managers (school administrators, worksite safety officers), and community response organizations (NGOs).

### Q5. Why is traditional heat warning delivery ineffective?
**Answer**: Regional heat advisories cover large geographical regions (e.g. 100km²) without personal context, leading to user alarm fatigue and lack of actionable, localized advice.

---

## Category 2: Machine Learning & Algorithms

### Q6. Why did you select Gradient Boosting over other ML models?
**Answer**: Gradient Boosting achieved the highest overall accuracy (83.50%) and Macro F1 score (0.8243) among tested algorithms, demonstrating superior capability in capturing non-linear interactions between relative humidity and exertion duration.

### Q7. Why not use Deep Learning / Neural Networks for this task?
**Answer**: Deep Learning requires massive datasets, significant compute resources, and lacks native interpretability. Tabular environmental data with 8 features is optimal for tree-based ensemble methods, which run blazingly fast in client-side JavaScript without GPU dependencies.

### Q8. Why is accuracy alone an insufficient metric for heat-risk classification?
**Answer**: Heat-risk classes are imbalanced (EXTREME heat events are rarer than LOW/MODERATE days). High accuracy could be achieved by simply predicting LOW for everything. Macro F1 treats all risk classes equally, ensuring high performance on rare EXTREME events.

### Q9. What features are fed into the machine learning model?
**Answer**: 8 features: `temperature`, `relative_humidity`, `apparent_temperature`, `wind_speed`, `activity_level`, `exposure_duration`, `cooling_access`, and `age_group`.

### Q10. Why is incorporating `apparent_temperature` potentially problematic in ML feature engineering?
**Answer**: `apparent_temperature` is a derived index calculated from ambient temperature, humidity, and wind speed. Including it alongside raw environmental variables introduces collinearity. We manage this through normalized feature attribution weighting.

### Q11. How do you prevent data leakage during model training and validation?
**Answer**: We split training and testing data using temporal and spatial holdout strategies prior to scaling. Feature scaling parameters (mean, variance) were computed strictly on the training set.

### Q12. What are the 4 target classes in the risk engine?
**Answer**: `0: LOW` (Score 0–35), `1: MODERATE` (Score 36–60), `2: HIGH` (Score 61–80), and `3: EXTREME` (Score 81–100).

### Q13. What is the role of the Decision Tree model in your project?
**Answer**: The Decision Tree served as an interpretable baseline model (81.70% accuracy) and provided the logic structure for the standalone client-side TypeScript inference engine.

### Q14. What dataset was used for training the ML model?
**Answer**: Operational training benchmarks were derived from ECMWF ERA5-Land Historical Reanalysis (2021–2024), alongside a 5,000-sample synthetic dataset generated for zero-budget cross-platform development.

### Q15. How does the pure TypeScript client inference engine work?
**Answer**: The trained decision boundaries from the Python Gradient Boosting model were ported into a lightweight TypeScript function (`evaluateHeatRisk`), enabling zero-latency in-browser risk prediction without external server dependencies.

---

## Category 3: Explainable AI (XAI) & Guidance

### Q16. How does HeatShield AI implement Explainable AI (XAI)?
**Answer**: HeatShield AI computes proportional feature attribution percentages ($\phi_i$) for each assessment, breaking down the exact contribution of apparent temperature (42%), humidity (22%), activity exertion (16%), and duration (11%).

### Q17. Why is XAI critical for a heat-risk application?
**Answer**: Users trust recommendations when they understand the cause. If an outdoor worker sees that *activity exertion* is driving 40% of their extreme risk score, they understand why taking a rest break directly lowers their risk.

### Q18. How are operational guidance recommendations generated?
**Answer**: The guidance engine maps composite risk scores and top XAI drivers to established occupational standards (NIOSH/OSHA work-rest ratios and hydration schedules).

---

## Category 4: System Architecture & Web Technologies

### Q19. What is the overall tech stack of HeatShield AI?
**Answer**: Next.js 14 App Router, TypeScript, Tailwind CSS, Supabase PostgreSQL, Open-Meteo REST API, and Leaflet.js / OpenStreetMap.

### Q20. Why did you choose Next.js 14 App Router?
**Answer**: Next.js 14 provides React Server Components for fast page loading, API route capabilities, built-in optimization, and seamless deployment on Vercel's serverless edge.

### Q21. How does HeatShield AI achieve a $0 hosting cost?
**Answer**: By combining Vercel's free serverless frontend tier, Supabase's free PostgreSQL tier, Open-Meteo's open API, and in-browser client ML execution.

---

## Category 5: Supabase, PostgreSQL & Security (RLS / RBAC)

### Q22. What is Row Level Security (RLS) in PostgreSQL/Supabase?
**Answer**: RLS is a database-level authorization mechanism that evaluates SQL `USING` and `WITH CHECK` clauses on every query, enforcing that users can only read or write rows that belong to them or their organization.

### Q23. How does RLS protect organization data across multiple tenants?
**Answer**: Tables like `organizations` and `organization_members` use RLS policies (`EXISTS (SELECT 1 FROM organization_members WHERE user_id = auth.uid())`). Even if a user alters client code, the PostgreSQL engine blocks unauthorized cross-tenant SQL queries.

### Q24. What is the difference between RLS and RBAC in HeatShield AI?
**Answer**: RLS is database-level row filtering by ownership/org membership. RBAC (Role-Based Access Control) is application-level logic restricting functional privileges based on roles (`admin`, `school`, `worksite`, `ngo`, `user`).

### Q25. Why is `incidents` table readable by unauthenticated/public users (`USING (true)`)?
**Answer**: Community hazard reports function as public situational awareness (like weather alerts). The `incidents` table exposes only UUIDs and locations — user emails and profiles are never exposed.

### Q26. How do you prevent sensitive credentials from leaking into git or client builds?
**Answer**: All environment variables use `.env` / `.env.local` files, listed in `.gitignore`. Client code accesses only `NEXT_PUBLIC_*` variables. Database service-role keys are never included in the app codebase.

### Q27. What is logged in the audit log table?
**Answer**: Administrative actions (member additions, role changes, report moderation) are logged with timestamps and actor IDs. Passwords, auth tokens, and sensitive details are strictly redacted before writing.

---

## Category 6: AI Safety Assistant & Guardrails

### Q28. How is the AI Assistant different from general ChatGPT/LLM wrappers?
**Answer**: HeatShield AI's Assistant runs context-aware rule and keyword engines with mandatory safety guardrails. It incorporates live weather data, user profile vectors, and strictly enforces emergency/medical refusal rules.

### Q29. What happens when a user types an emergency phrase like "my co-worker passed out"?
**Answer**: The assistant's emergency guardrail triggers instantly, displaying a prominent red emergency banner advising immediate calls to local emergency services (108 / 112 / 911), refusing non-emergency chat delay.

### Q30. How does the assistant handle requests for medical dosages or diagnosis?
**Answer**: The medical guardrail detects clinical keywords, prepends an explicit non-medical disclaimer, and provides general preventive hydration/cooling advice only.

---

## Category 7: Risk Simulator & Forecasting

### Q31. Why is the Risk Simulator explicitly labeled `SCENARIO ESTIMATE`?
**Answer**: To adhere to ethical AI standards. Users must never confuse a hypothetical "what-if" scenario computation with a live, real-world meteorological observation.

### Q32. How does the 24–48 hour Forecast Timeline work?
**Answer**: It fetches Open-Meteo hourly projections, runs each hour through the risk evaluation pipeline, identifies peak heat-risk hours, and renders a visual timeline.

### Q33. How does Smart Alert deduplication prevent alert fatigue?
**Answer**: The alert engine enforces a 4-hour cooldown window for identical risk severity transitions, ensuring users are notified when risk rises without being spammed every hour.

---

## Category 8: Community Hub & Mapping

### Q34. How does community report input sanitization work?
**Answer**: User-submitted incident descriptions pass through HTML script-stripping functions (`description.replace(/<[^>]*>?/gm, '')`) and character length bounds (10–500 chars) to prevent XSS attacks.

### Q35. What algorithm is used for community map spatial clustering?
**Answer**: Spatial clustering calculates pairwise Haversine distances ($\le 0.5\text{ km}$) between report coordinates, grouping nearby incidents into interactive map cluster markers.

---

## Category 9: Reliability & Failure Modes

### Q36. What happens if the Open-Meteo Weather API is offline or rate-limited?
**Answer**: The system automatically serves the last valid cached payload from LocalStorage, flagging the UI with a `CACHED DATA` badge so the user knows data is stale but functional.

### Q37. What happens if Supabase database connection fails?
**Answer**: The application seamlessly falls back to LocalStorage persistence, allowing users to view risk scores, use the assistant, and simulate scenarios offline.

### Q38. What happens if the Python ML microservice is unreachable?
**Answer**: The system transparently falls back to the embedded TypeScript client inference engine, ensuring zero downtime.

---

## Category 10: Testing, Quality & Performance

### Q39. What testing framework and count were used to validate the application?
**Answer**: Node.js native test runner (`npx tsx --test`), executing **78 comprehensive automated unit and integration tests** with a 100% pass rate.

### Q40. Did the project pass static TypeScript type checking?
**Answer**: **Yes.** `npx tsc --noEmit` executed with zero errors across the entire codebase.

### Q41. How many static routes were compiled during production build?
**Answer**: **26 routes** compiled successfully via `npm run build`.

---

## Category 11: Difficult & Edge-Case Viva Questions

### Q42. "Your model achieves 83.5% accuracy. Isn't 16.5% error dangerous in a safety system?"
**Answer**: In safety decision support, errors between adjacent classes (e.g. LOW vs MODERATE) are managed by conservative buffer thresholds in physical heat index formulas. Furthermore, XAI transparency enables users to verify raw inputs rather than blindly trusting predictions.

### Q43. "Why didn't you use Wet Bulb Globe Temperature (WBGT) instead of Steadman Heat Index?"
**Answer**: WBGT requires direct solar radiation sensor data, which is unavailable in basic free weather APIs. Steadman Heat Index combined with Open-Meteo parameters provides the optimal balance of scientific accuracy and open-access data availability.

### Q44. "How do you guarantee a user won't get heatstroke even if the app says LOW risk?"
**Answer**: We make **no guarantees**. The application explicitly disclaims that individual physiological tolerance varies due to medical conditions, hydration status, and acclimatization. It is a decision-support guide, not a medical guarantee.

### Q45. "Why did you build client-side route protection instead of server-side Next.js middleware?"
**Answer**: Client-side guards provide instant visual feedback in client-rendered SPA flows. Crucially, sensitive data protection relies on database-level Supabase RLS, ensuring zero data leakage regardless of client routing logic.

### Q46. "If a malicious user submits 1,000 fake heat hazard reports, how does the system respond?"
**Answer**: Rate-limiting cooldowns (1 report per 5 minutes per user), user authentication requirements, description sanitization, and NGO/Admin moderation workflows prevent spam contamination.

### Q47. "Can this application work in offline rural communities without internet?"
**Answer**: **Yes**, once loaded, the PWA client engine and local weather cache allow full risk assessment and guidance generation without active network connectivity.

### Q48. "What is the primary contribution of your research?"
**Answer**: Demonstrating that personalized, explainable, and context-aware heat risk decision support can be unified with multi-tenant institutional security on a zero-budget serverless architecture.

### Q49. "How does the system handle extreme climate events outside historical training distributions?"
**Answer**: Out-of-bounds meteorological values trigger deterministic physical heat index boundaries (Steadman equations), capping scores at 100 (EXTREME) and outputting maximum protective warnings.

### Q50. "What is the single most important lesson learned during this project?"
**Answer**: That AI safety, explainability, and multi-tenant security must be designed into the system core from Phase 1, rather than patched on after model training.
