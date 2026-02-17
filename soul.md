# Soul of X Bookmarks Tab

This document preserves the product's core intent so decisions do not drift over time.

## Core Purpose

Help people remember and actually read what they saved on X, without needing to open X first and risk distraction.

## Product Soul (Non-Negotiables)

1. Visibility over friction: saved bookmarks should stay in front of the user.
2. Reading over scrolling: the experience should pull attention toward intentional reading.
3. Calm over addiction loops: avoid patterns that lead users back into infinite feeds.
4. Utility over novelty: features must support recall, completion, and focus.

## Feature Filter (Ship / Don’t Ship)

Run every proposed feature through these checks:

1. Reminder strength: Does it increase the chance users see saved bookmarks daily?
2. Reading completion: Does it help users finish saved reading, not just collect more?
3. Distraction risk: Could it pull users back into X feed behavior?
4. Effort cost: Is the value high enough for the added UI/mental complexity?
5. Soul alignment: Does it directly support the core purpose in this doc?

Decision rule:

- Ship only if answers to 1, 2, and 5 are clearly `yes`.
- Do not ship if 3 is `yes` unless there is a strong mitigation.
- Prefer the simpler option when two features deliver similar value.

## How to Add New Entries

Use one entry per date in `YYYY-MM-DD` format:

- `Date`
- `Context`
- `What user pain we are solving`
- `Decision / direction`
- `What we explicitly avoid`
- `How we know it is working`

---

## Soul Register

### 2026-02-13
- `Context`: Product direction clarification.
- `What user pain we are solving`: People save Twitter/X bookmarks to read later, but they forget them. Opening X to check bookmarks often causes distraction into unrelated tweets.
- `Decision / direction`: Build the product as a persistent reminder surface for bookmarked content, so saved items stay visible in everyday browsing workflows.
- `What we explicitly avoid`: Flows that require users to visit X first just to see what they intended to read.
- `How we know it is working`: Users regularly revisit and complete saved reading from the reminder surface, with less dependence on opening X directly.
