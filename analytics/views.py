from rest_framework.views import APIView
from rest_framework.response import Response
import pandas as pd
import os
from django.conf import settings

def get_merged_data(cooldown_setting=52, holding_weeks=52):
    """
    Helper to load data based on the holding weeks (CSV vs Excel) 
    and filter by cooldown setting (20-104).
    """
    mcap_file = os.path.join(settings.BASE_DIR, "data", "MCAP-NSE-0711.csv")
    
    # 1. Select File based on Holding Weeks
    try:
        if int(holding_weeks) == 52:
            main_file = os.path.join(settings.BASE_DIR, "data", "NRB_Comprehensive_20_104_20260128_1458.xlsx")
            df = pd.read_excel(main_file, engine="openpyxl")
        else:
            file_name = f"NRB_Cooldown_20-104_{holding_weeks}weeks.csv"
            main_file = os.path.join(settings.BASE_DIR, "data", file_name)
            if not os.path.exists(main_file):
                raise FileNotFoundError(f"File not found: {main_file}")
            df = pd.read_csv(main_file)
    except Exception as e:
        print(f"Error loading file: {e}")
        return pd.DataFrame()

    # 2. Normalize and Filter Cooldown
    df.columns = [str(c).strip() for c in df.columns]
    df = df[df['Cooldown Setting'] == int(cooldown_setting)].copy()

    # 3. MCAP Processing & Microcap Removal
    mcap_df = pd.read_csv(mcap_file)
    mcap_df["Market Capitalisation"] = pd.to_numeric(
        mcap_df["Market Capitalisation"].astype(str).str.replace(",", "", regex=True), 
        errors="coerce"
    )
    mcap_df = mcap_df.sort_values(by="Market Capitalisation", ascending=False).reset_index(drop=True)

    # Microcap = Anything outside Top 500
    def get_category(rank):
        if rank < 50: return "Mega"
        if rank < 100: return "Large"
        if rank < 250: return "Mid"
        if rank < 500: return "Small"
        return None 

    mcap_df["mcap_category"] = mcap_df.index.map(get_category)
    mcap_map = dict(zip(mcap_df["NSE Symbol"], mcap_df["mcap_category"]))

    df["mcap_category"] = df["Symbol"].map(mcap_map)
    df = df.dropna(subset=["mcap_category"]) # Removes Microcaps

    # 4. Standardize Logic Columns
    RENAME_MAP = {
        '12-Month %': 'return_val',
        '12-month %': 'return_val',
        'Duration': 'duration_val',
        'Breakout Date': 'breakout_dt'
    }
    df = df.rename(columns=RENAME_MAP)
    df["return_val"] = pd.to_numeric(df["return_val"], errors="coerce")
    df["duration_val"] = pd.to_numeric(df["duration_val"], errors="coerce")
    df["breakout_dt"] = pd.to_datetime(df["breakout_dt"], errors="coerce")

    return df.dropna(subset=["return_val", "duration_val", "breakout_dt"])

class DateRangeView(APIView):
    """Returns min and max dates for the specific selected file/cooldown"""
    def get(self, request):
        try:
            holding_weeks = request.query_params.get("weeks", 52)
            cooldown = request.query_params.get("cooldown_weeks", 52)
            df = get_merged_data(cooldown_setting=cooldown, holding_weeks=holding_weeks)
            
            if df.empty:
                return Response({"min_date": None, "max_date": None})
            
            return Response({
                "min_date": df['breakout_dt'].min().strftime('%Y-%m-%d'),
                "max_date": df['breakout_dt'].max().strftime('%Y-%m-%d')
            })
        except Exception as e:
            return Response({"error": str(e)}, status=500)

class SectorListView(APIView):
    def get(self, request):
        df = get_merged_data(holding_weeks=52) # Use default for sector list
        sectors = sorted(df["Sector"].astype(str).unique().tolist())
        return Response(sectors)

class DashboardDataView(APIView):
    def get(self, request):
        try:
            holding_weeks = request.query_params.get("weeks", 52)
            cooldown = request.query_params.get("cooldown_weeks", 52)
            df = get_merged_data(cooldown_setting=cooldown, holding_weeks=holding_weeks)

            # Apply Filters
            start = request.query_params.get("start_date")
            end = request.query_params.get("end_date")
            if start: df = df[df["breakout_dt"] >= pd.to_datetime(start)]
            if end: df = df[df["breakout_dt"] <= pd.to_datetime(end)]
            
            sector = request.query_params.get("sector")
            if sector and sector != "All": df = df[df["Sector"] == sector]

            mcap = request.query_params.get("mcap")
            if mcap and mcap != "All": df = df[df["mcap_category"] == mcap]

            # Success Range Processing
            success_df = df[df["return_val"] >= 20].copy()
            if success_df.empty: return Response([])

            success_df["duration_rounded"] = success_df["duration_val"].round().astype(int)
            bins = [20, 40, 60, 80, 100, float("inf")]
            labels = ["20-40%", "40-60%", "60-80%", "80-100%", ">100%"]
            success_df["range"] = pd.cut(success_df["return_val"], bins=bins, labels=labels, right=False)

            chart_data = success_df.groupby(["duration_rounded", "range"]).size().unstack(fill_value=0)
            
            response_data = []
            for dur, row in chart_data.iterrows():
                entry = {"duration": dur}
                for lbl in labels: entry[lbl] = row.get(lbl, 0)
                response_data.append(entry)

            return Response(sorted(response_data, key=lambda x: x["duration"]))
        except Exception as e:
            return Response({"error": str(e)}, status=500)

class KPIDataView(APIView):
    def get(self, request):
        try:
            holding_weeks = request.query_params.get("weeks", 52)
            cooldown = request.query_params.get("cooldown_weeks", 52)
            df = get_merged_data(cooldown_setting=cooldown, holding_weeks=holding_weeks)

            # [Apply Same Filters as DashboardDataView]
            total = len(df)
            if total > 0:
                best = df.loc[df["return_val"].idxmax()]
                return Response({
                    "total_samples": total,
                    "most_profitable": {"name": best["Symbol"], "return": round(best["return_val"], 2)},
                    "average_duration": round(df["duration_val"].mean(), 1),
                    "success_rate": round(df["return_val"].mean(), 1)
                })
            return Response({"total_samples": 0, "most_profitable": {"name": "N/A", "return": 0}, "average_duration": 0, "success_rate": 0})
        except Exception as e:
            return Response({"error": str(e)}, status=500)