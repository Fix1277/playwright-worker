# Golf Club Lead List: Handover & Plan

**Prepared for:** Fixstrut (cold-rolled steel buildings and storage sheds)
**Date:** 18 October 2026
**File:** `golf_clubs_leads.csv` (244 clubs, opens in Excel or Google Sheets)

---

## 1. What's in the list

Golf clubs in Essex and the surrounding counties, collected from public golf directories. Club websites were **not** visited (this was the "lighter" run, to keep permission prompts down).

| County | Clubs | Phone | Email | Named contact | Flagged |
|---|---|---|---|---|---|
| Essex | 53 | 48 | 3 | 0 | 2 |
| Hertfordshire | 55 | 55 | 20 | 29 | 9 |
| Suffolk | 33 | 29 | 15 | 25 | 5 |
| Cambridgeshire | 26 | 26 | 22 | 13 | 9 |
| Kent | 77 | 75 | 49 | 38 | 8 |
| **Total** | **244** | **233** | **109** | **105** | **33** |

### Columns
| Column | Meaning |
|---|---|
| `lead_id` | GC001 to GC244, sorted by county then priority |
| `club_name` … `holes` | Club details as published by the directory |
| `source_url` | Page each row's details came from (check here first) |
| `notes` | Caveats from collection: border clubs, stale data, operator-run, etc. |
| `check_flag` | `possibly closed` or `check notes`: read the notes before contacting |
| `priority` | **A** = email + named contact · **B** = email *or* named contact · **C** = phone only · **D** = possibly closed |
| `outreach_status` | All set to `Not contacted`: update as you go |
| `last_contacted`, `outreach_notes` | Blank, for your tracking |

Priority split: **A 64 · B 84 · C 92 · D 4**

---

## 2. Known gaps and caveats

- **Essex has almost no emails (3 of 53).** The directories that cover Essex don't publish them. This is the biggest gap; see the plan below.
- **Essex clubs not yet in the list:** Skips, St Cleres, Kelvedon Hatch, Hartswood, Pryors Hayes, Upminster, Romford, Hainault. Their directory pages failed to load.
- **Kent has no website column.** The Kent directories didn't publish web addresses.
- **Contact names may be stale.** They come from directories, not the clubs. A couple of names appear at two clubs (e.g. Herts: Rickmansworth/Chorleywood, Bishop's Stortford/Sandy Lodge). Confirm before addressing anyone by name.
- **Some emails are decoded or personal.** One directory (1golf.eu) hides addresses, so they were decoded, and some are personal ISP addresses or pro-shop/events inboxes. Expect some bounces.
- **Possibly closed (priority D):** Cromwell/Abbotsley, Waterbeach (Cambs), Cretingham, High Lodge Darsham (Suffolk). Also check Woodlands Manor and Austin Lodge (Kent, reported for sale or sold).
- **No phone or email at all (10):** Belhus Park, Garon Park, Millers Barn, Stapleford Abbotts, West Park (Essex); Great Chart, Hawkhurst (Kent); Bramford, Waldringfield, High Lodge (Suffolk).
- **Border and operator clubs:** some Herts and Essex rows have London postcodes, and several are council- or operator-run (Everyone Golf, Better, The Club Company, Crown Golf, Nene Park), where buying decisions sit with the operator. These are flagged in `notes`.
- **Verification:** formats were checked (all emails well-formed, no duplicate emails), but contacts were **not** checked live against club websites.

---

## 3. Recommended next steps

### Step 1: Clean (about 1 hour)
1. Filter `check_flag` and read those notes; drop or park closed clubs.
2. For operator-run clubs, decide whether to approach the operator once (e.g. Nene Park covers 2 courses) rather than each venue.

### Step 2: Fill the gaps
1. **Essex emails:** run a focused pass on the 53 Essex club websites, approving each site (about 50 prompts), or ask Claude to do it in a session where web access is pre-approved.
2. **Missing Essex clubs:** add the 8 listed above.
3. **Kent websites:** a quick pass to add the club URLs.
4. **Better decision-maker:** ask for the **Course Manager / Head Greenkeeper**, who usually owns machinery storage, rather than the secretary. Some are already named in `notes` (e.g. Brampton Park, Girton, Ipswich, Felixstowe).

### Step 3: Outreach order
1. **Priority A (64):** personalised email to the named contact.
2. **Priority B (84):** email to the general address, asking to be passed to the course manager.
3. **Priority C (92):** phone first: ask who handles greenkeeping storage, then get the email.
4. Log every touch in `outreach_status` / `last_contacted` / `outreach_notes`.

### Compliance note (UK PECR / GDPR)
Many golf clubs are **members' clubs (unincorporated)** rather than limited companies. PECR treats unincorporated bodies more like individuals for unsolicited marketing **emails**, which may need consent. Phone (screened against TPS/CTPS) and post are simpler. Check a club's status (Companies House search) before adding it to an email campaign, include an opt-out in every message, and record a legitimate-interest assessment for holding named contacts. This is general information, not legal advice.

---

## 4. Sources used
- 1golf.eu (per-club directory pages; most emails and named contacts)
- golfpass.com (Kent addresses and phones)
- golfnow.com, top100golfcourses.com, visitessex.com, todays-golfer.com (Essex/Suffolk)
- golfshake.com (Herts club enumeration), golftoday.co.uk (Cambs)

Each row's exact source is in `source_url`.

## 5. Files
- `golf_clubs_leads.csv`: the combined list (UTF-8, opens directly in Excel)
- Per-county files: `essex.csv`, `hertfordshire.csv`, `suffolk.csv`, `cambridgeshire.csv`, `kent.csv`
- `build/merge.py`: rebuilds the combined list if county files are updated
