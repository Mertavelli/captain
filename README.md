# CAPTAIN – AI Project Manager

CAPTAIN is an AI Project Manager for engineering teams — focused on ticket hygiene, backlog quality & communication clarity.

Think of CAPTAIN as the first non-human PM that keeps Jira clean — without human micromanagement.

Built solo, full-stack + domain design.

---

## Why this exists
Most software execution problems aren’t architectural — they’re coordination failures.

Ticket hygiene kills velocity *far more* than technical difficulty.

CAPTAIN eliminates backlog entropy.

---

## What CAPTAIN does
- reads Slack threads → infers state → updates Jira automatically
- rewrites, clarifies & normalizes tickets
- ensures backlog consistency & grooming
- reduces PM attention drain

---

## Tech Stack
| Layer | Tools |
|---|---|
| Frontend | Next.js |
| Auth | OAuth2 |
| AI Runtime | OpenAI Agents SDK |
| Backend | Supabase |

---

## Architecture — high level
Slack / Jira → CAPTAIN interpreter → action engine → Jira mutations

Agents decide meaning → system enforces state correction.

---

## Live / Demo
- Landing: https://captain-landingpage-v2.vercel.app
- Demo Video: https://youtu.be/dYV8AEKDEMQ?si=jTWiOWYvpLskt0Nl

---

## Role
Solo built: conception → product → infra → agent logic.

Year built: 2025

---

## What was interesting here
- Slack → semantic state extraction
- Jira writing with causal constraints
- PM automation as a mechanical system (not chat)

---

## Status
Active internal product
