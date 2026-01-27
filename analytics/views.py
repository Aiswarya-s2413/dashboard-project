from rest_framework.views import APIView
from rest_framework.response import Response
import pandas as pd
import os
from django.conf import settings


# Helper to load and merge data
def get_merged_data():
    # 1. Define File Paths (look in data folder inside project root)
    main_file = os.path.join(settings.BASE_DIR, "data", "NRB_Without_MicroCap.xlsx")
    mcap_file = os.path.join(settings.BASE_DIR, "data", "MCAP-NSE-0711.csv")

    # Check if files exist
    if not os.path.exists(main_file):
        raise FileNotFoundError(f"Data file not found at: {main_file}")
    if not os.path.exists(mcap_file):
        raise FileNotFoundError(f"MCAP file not found at: {mcap_file}")

    # 2. Read Main Data
    df = pd.read_excel(main_file, engine="openpyxl")

    # 3. Read & Process Mcap Data
    mcap_df = pd.read_csv(mcap_file)

    # Clean Mcap column (remove commas, convert to float)
    mcap_df["Market Capitalisation"] = (
        mcap_df["Market Capitalisation"].astype(str).str.replace(",", "", regex=True)
    )
    mcap_df["Market Capitalisation"] = pd.to_numeric(
        mcap_df["Market Capitalisation"], errors="coerce"
    )

    # Sort by Mcap to determine categories
    mcap_df = mcap_df.sort_values(
        by="Market Capitalisation", ascending=False
    ).reset_index(drop=True)

    # Assign Categories based on Rank (Standard Indian Classification approach)
    # Mega: Top 50, Large: 51-100, Mid: 101-250, Small: 251+
    def get_category(rank):
        if rank < 50:
            return "Mega"
        if rank < 100:
            return "Large"
        if rank < 250:
            return "Mid"
        return "Small"

    mcap_df["mcap_category"] = mcap_df.index.map(get_category)

    # Create a mapping dictionary: Symbol -> Category
    # Assuming 'NSE Symbol' is the common column
    mcap_map = dict(zip(mcap_df["NSE Symbol"], mcap_df["mcap_category"]))

    # 4. Merge Category into Main DataFrame
    df["mcap_category"] = (
        df["symbol"].map(mcap_map).fillna("Small")
    )  # Default to Small if not found

    # 5. General Cleaning
    df["12-month %"] = pd.to_numeric(df["12-month %"], errors="coerce")
    df["duration"] = pd.to_numeric(df["duration"], errors="coerce")
    df["breakout date"] = pd.to_datetime(df["breakout date"], errors="coerce")

    # Remove invalid rows
    df = df.dropna(subset=["12-month %", "duration", "breakout date"])

    return df


class SectorListView(APIView):
    """Returns a list of unique sectors for the dropdown"""

    def get(self, request):
        try:
            df = get_merged_data()
            sectors = sorted(df["sector"].astype(str).unique().tolist())
            return Response(sectors)
        except Exception as e:
            return Response({"error": str(e)}, status=500)


class DashboardDataView(APIView):
    """Returns the filtered graph data"""

    def get(self, request):
        try:
            df = get_merged_data()

            # --- APPLY FILTERS ---

            # 1. Date Range Filter (using 'breakout date')
            start_date = request.query_params.get("start_date")
            end_date = request.query_params.get("end_date")

            if start_date:
                df = df[df["breakout date"] >= pd.to_datetime(start_date)]
            if end_date:
                df = df[df["breakout date"] <= pd.to_datetime(end_date)]

            # 2. Sector Filter
            sector = request.query_params.get("sector")
            if sector and sector != "All":
                df = df[df["sector"] == sector]

            # 3. Mcap Category Filter
            mcap_cat = request.query_params.get("mcap")
            if mcap_cat and mcap_cat != "All":
                # Map frontend 'Mega', 'Large' etc to our column
                df = df[df["mcap_category"] == mcap_cat]

            # --- PROCESS GRAPH DATA ---

            # Filter for Success (>= 20%)
            success_df = df[df["12-month %"] >= 20].copy()

            if success_df.empty:
                return Response([])

            # Round Duration
            success_df["duration_rounded"] = success_df["duration"].round().astype(int)

            # Categorize Success Levels
            bins = [20, 40, 60, 80, 100, float("inf")]
            labels = ["20-40%", "40-60%", "60-80%", "80-100%", ">100%"]

            success_df["success_range"] = pd.cut(
                success_df["12-month %"], bins=bins, labels=labels, right=False
            )

            # Group Data
            chart_data = (
                success_df.groupby(["duration_rounded", "success_range"])
                .size()
                .unstack(fill_value=0)
            )

            # Format JSON
            response_data = []
            for duration, row in chart_data.iterrows():
                entry = {"duration": duration}
                for label in labels:
                    entry[label] = row.get(label, 0)
                response_data.append(entry)

            response_data.sort(key=lambda x: x["duration"])
            return Response(response_data)

        except Exception as e:
            print(f"Error: {e}")
            return Response({"error": str(e)}, status=500)


class KPIDataView(APIView):
    """Returns KPI metrics based on filtered data"""

    def get(self, request):
        try:
            df = get_merged_data()

            # --- APPLY FILTERS (same as DashboardDataView) ---
            start_date = request.query_params.get("start_date")
            end_date = request.query_params.get("end_date")

            if start_date:
                df = df[df["breakout date"] >= pd.to_datetime(start_date)]
            if end_date:
                df = df[df["breakout date"] <= pd.to_datetime(end_date)]

            sector = request.query_params.get("sector")
            if sector and sector != "All":
                df = df[df["sector"] == sector]

            mcap_cat = request.query_params.get("mcap")
            if mcap_cat and mcap_cat != "All":
                df = df[df["mcap_category"] == mcap_cat]

            # --- CALCULATE KPIs ---
            total_samples = len(df)
            
            # Most profitable stock
            if total_samples > 0:
                most_profitable = df.loc[df["12-month %"].idxmax()]
                most_profitable_name = most_profitable.get("symbol", "N/A")
                most_profitable_return = round(most_profitable["12-month %"], 2)
            else:
                most_profitable_name = "N/A"
                most_profitable_return = 0

            # Average duration
            avg_duration = round(df["duration"].mean(), 1) if total_samples > 0 else 0

            # Average success rate (average return percentage of all companies)
            success_rate = round(df["12-month %"].mean(), 1) if total_samples > 0 else 0

            return Response({
                "total_samples": total_samples,
                "most_profitable": {
                    "name": most_profitable_name,
                    "return": most_profitable_return
                },
                "average_duration": avg_duration,
                "success_rate": success_rate
            })

        except Exception as e:
            print(f"Error calculating KPIs: {e}")
            return Response({"error": str(e)}, status=500)
