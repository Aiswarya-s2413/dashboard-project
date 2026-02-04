import os
import pandas as pd
import django
from django.conf import settings

# --- SETUP DJANGO ENVIRONMENT ---
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from analytics.models import TradingData

def get_mcap_map():
    print("📋 Loading MCAP categories...")
    mcap_file = os.path.join(settings.BASE_DIR, "data", "MCAP-NSE-0711.csv")
    mcap_df = pd.read_csv(mcap_file)
    mcap_df["Market Capitalisation"] = pd.to_numeric(
        mcap_df["Market Capitalisation"].astype(str).str.replace(",", "", regex=True), 
        errors="coerce"
    )
    mcap_df = mcap_df.sort_values(by="Market Capitalisation", ascending=False).reset_index(drop=True)

    def get_category(rank):
        if rank < 50: return "Mega"
        if rank < 100: return "Large"
        if rank < 250: return "Mid"
        if rank < 500: return "Small"
        return "Micro"

    mcap_df["mcap_category"] = mcap_df.index.map(get_category)
    return dict(zip(mcap_df["NSE Symbol"], mcap_df["mcap_category"]))

def ingest_file(file_path, holding_weeks, mcap_map):
    print(f"🚀 Processing {file_path} ({holding_weeks} weeks)...")
    
    # Check if Excel or CSV
    if file_path.endswith('.xlsx'):
        df = pd.read_excel(file_path, engine="openpyxl")
    else:
        # For millions of rows, we read in chunks to save RAM
        chunk_reader = pd.read_csv(file_path, chunksize=50000)
        for chunk in chunk_reader:
            process_chunk(chunk, holding_weeks, mcap_map)
        return

    process_chunk(df, holding_weeks, mcap_map)

def process_chunk(df, holding_weeks, mcap_map):
    # Normalize columns
    df.columns = [str(c).strip() for c in df.columns]
    
    # Rename map for your specific files
    rename_map = {
        '12-Month %': 'ret', '12-month %': 'ret',
        'Duration': 'dur', 'Breakout Date': 'date',
        'Symbol': 'sym', 'Company': 'comp', 'Sector': 'sect',
        'Cooldown Setting': 'cool'
    }
    df = df.rename(columns=rename_map)

    objs = []
    for _, row in df.iterrows():
        # Exclude Microcaps immediately
        mcap = mcap_map.get(row['sym'], "Micro")
        if mcap == "Micro":
            continue

        objs.append(TradingData(
            symbol=row['sym'],
            company=row.get('comp', ''),
            sector=row.get('sect', 'Other'),
            cooldown_setting=int(row['cool']),
            holding_weeks=holding_weeks,
            mcap_category=mcap,
            breakout_date=pd.to_datetime(row['date']).date(),
            duration=float(row['dur']),
            return_percentage=float(row['ret'])
        ))

        # Batch insert every 5,000 records to keep memory stable
        if len(objs) >= 5000:
            TradingData.objects.bulk_create(objs)
            objs = []
            print(f"  ✅ Inserted 5,000 rows...")

    if objs:
        TradingData.objects.bulk_create(objs)

def run():
    # Clear old data (Optional: remove if you want to append)
    print("🗑️ Clearing existing data...")
    TradingData.objects.all().delete()

    mcap_map = get_mcap_map()
    data_dir = os.path.join(settings.BASE_DIR, "data")

    # Define your week files (Add more to this list as needed)
    files_to_process = [
        ("NRB_Comprehensive_20_104_52weeks_20260128_1458.xlsx", 52),
        ("NRB_Cooldown_20-104_26weeks_20260204_0902.xlsx", 26),
        ("NRB_Cooldown_20-104_78weeks_20260204_1116.xlsx", 78),
        ("NRB_Cooldown_20-104_104weeks_20260203_0813.xlsx", 104),
        ("NRB_Cooldown_20-104_156weeks_20260203_1159.xlsx", 156),
        ("NRB_Cooldown_20-104_208weeks_20260203_1741.xlsx", 208),
        
        # Add your other CSV names here
    ]

    for filename, weeks in files_to_process:
        path = os.path.join(data_dir, filename)
        if os.path.exists(path):
            ingest_file(path, weeks, mcap_map)
        else:
            print(f"⚠️ Skipping {filename} (File not found)")

    print("🏁 Ingestion complete!")

if __name__ == "__main__":
    run()