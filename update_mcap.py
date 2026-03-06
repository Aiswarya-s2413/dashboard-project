"""
update_mcap.py
--------------
Fetches the latest market capitalisation data for all NSE stocks
using yfinance, then produces a fresh CSV in the same format as
MCAP-NSE-0711.csv so that ingest_data.py can use it directly.

Usage:
    pip install yfinance pandas
    python update_mcap.py
    
Output:
    data/MCAP-NSE-latest.csv   (same columns as MCAP-NSE-0711.csv)

This will take 10–25 minutes depending on your internet speed,
because yfinance fetches one ticker at a time.
"""

import pandas as pd
import yfinance as yf
import os
import time
from datetime import date

# ── Paths ──────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
INPUT_CSV  = os.path.join(BASE_DIR, "data", "MCAP-NSE-0711.csv")
today_str  = date.today().strftime("%d%m")          # e.g. 0603 for Mar-06
OUTPUT_CSV = os.path.join(BASE_DIR, "data", f"MCAP-NSE-{today_str}.csv")

# ── Load existing symbol list ──────────────────────────────────────────────
print(f"📋  Loading symbols from {INPUT_CSV} ...")
old_df = pd.read_csv(INPUT_CSV)
symbols = old_df["NSE Symbol"].dropna().unique().tolist()
print(f"    Found {len(symbols)} symbols.\n")

# ── Fetch market caps from yfinance ───────────────────────────────────────
rows = []
errors = []
total = len(symbols)

for i, sym in enumerate(symbols, 1):
    ticker_sym = sym.strip() + ".NS"
    try:
        info = yf.Ticker(ticker_sym).fast_info   # fast_info is much quicker
        mcap_inr = getattr(info, "market_cap", None)
        
        if mcap_inr and mcap_inr > 0:
            # Convert from ₹ (absolute) to ₹ Crores  (1 crore = 1e7)
            mcap_crores = mcap_inr / 1e7
        else:
            mcap_crores = 0.0

        rows.append({
            "NSE Symbol": sym,
            "Market Capitalisation": round(mcap_crores, 2)
        })
    except Exception as e:
        errors.append(sym)
        rows.append({"NSE Symbol": sym, "Market Capitalisation": 0.0})

    # Progress every 50 stocks
    if i % 50 == 0 or i == total:
        done  = sum(1 for r in rows if r["Market Capitalisation"] > 0)
        print(f"  [{i:>4}/{total}]  fetched {done} with valid market cap ...")

    # Tiny sleep to be polite to Yahoo's servers
    time.sleep(0.05)

# ── Build DataFrame & sort by market cap descending ───────────────────────
print("\n📊  Building final DataFrame ...")
result_df = pd.DataFrame(rows)
result_df = result_df.sort_values("Market Capitalisation", ascending=False).reset_index(drop=True)

# ── Save ───────────────────────────────────────────────────────────────────
os.makedirs(os.path.join(BASE_DIR, "data"), exist_ok=True)
result_df.to_csv(OUTPUT_CSV, index=False)
print(f"\n✅  Saved {len(result_df)} rows → {OUTPUT_CSV}")

if errors:
    print(f"\n⚠️   Could not fetch data for {len(errors)} symbols:")
    for e in errors[:20]:
        print(f"     • {e}")
    if len(errors) > 20:
        print(f"     ... and {len(errors) - 20} more.")

# ── Sanity check — show top 10 ─────────────────────────────────────────────
print("\n🏆  Top 10 by Market Cap (₹ Crores):")
print(result_df.head(10).to_string(index=False))

# ── Reminder to update ingest_data.py ─────────────────────────────────────
print(f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 NEXT STEP — update the filename in ingest_data.py:

   mcap_file = os.path.join(settings.BASE_DIR, "data", "MCAP-NSE-{today_str}.csv")

 Then re-run:  python ingest_data.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
""")
