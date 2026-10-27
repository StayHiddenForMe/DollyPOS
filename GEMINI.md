# Dolly POS - Version 2.0 (Laboratory / Staging Zone)

## Project Overview
This repository is the dedicated **Version 2.0 Staging & Development Sandbox** for Dolly POS (Dolly Toys & Kids Wear, Dhule).
It is completely isolated from the live store counter software running in Version 1.

---

## 🛡️ STRICT ISOLATION RULES (DO NOT VIOLATE)
1. **Never Touch Version 1**:
   - The live production workspace is `c:\Users\SomeshBang\Desktop\Antigravity DollyPos`.
   - The live production database is `dollytoyskidswear`.
   - **NEVER** edit, delete, query, or write to the Version 1 folder or the `dollytoyskidswear` database under any circumstances.
2. **Dedicated v2 Sandbox Database**:
   - Active Database: `dollytoys_v2_sandbox` (PostgreSQL 127.0.0.1:5432).
   - This sandbox contains a copy of the real product catalog (316 items), but **ZERO live customer sales, ZERO live invoices, ZERO live returns**.
   - All test bills, dummy transactions, and schema experiments must happen exclusively inside `dollytoys_v2_sandbox`.
3. **Dedicated Port 8001**:
   - The v2 backend is configured to run on **Port 8001** (`PORT=8001`).
   - This guarantees zero port collisions with Version 1 (which runs on Port 8000).
4. **Git Branching**:
   - All v2 development takes place on the `v2-development` branch.
   - Never push directly to `main` until Somesh explicitly confirms the full merge.

---

## 📋 SOMESH'S PROJECT RULES & WORKFLOW
1. **First We Discuss, Then We Code**:
   - Before writing or editing any code, explain the proposed design, math, or calculation step-by-step.
   - Get Somesh's confirmation before modifying files.
2. **Preserve Documentation & Comments**:
   - Maintain integrity of comments, explanations, and existing working features.
3. **Real Calculation Testing**:
   - Any financial or inventory formula change must be verified with concrete numerical examples.
4. *(Custom user rules can be added here)*
