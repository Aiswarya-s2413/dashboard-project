from rest_framework.views import APIView
from rest_framework.response import Response
import pandas as pd
import os
from django.conf import settings


# Helper to load and merge data
def get_merged_data(cooldown_weeks=52):
    """
    Load data from the comprehensive file with cooldown weeks support
    
    Args:
        cooldown_weeks: The cooldown period to filter by (20-104)
    """
    print(f"\n{'='*80}")
    print(f"🔍 GET_MERGED_DATA CALLED")
    print(f"{'='*80}")
    print(f"📊 Requested Cooldown Weeks: {cooldown_weeks}")
    print(f"📊 Cooldown Type: {type(cooldown_weeks)}")
    
    # 1. Define File Paths
    main_file = os.path.join(settings.BASE_DIR, "data", "NRB_Comprehensive_20_104_20260128_1458.xlsx")
    mcap_file = os.path.join(settings.BASE_DIR, "data", "MCAP-NSE-0711.csv")

    print(f"\n📁 File Paths:")
    print(f"   Main file: {main_file}")
    print(f"   MCAP file: {mcap_file}")

    # Check if files exist
    if not os.path.exists(main_file):
        print(f"❌ ERROR: Main file not found!")
        raise FileNotFoundError(f"Data file not found at: {main_file}")
    if not os.path.exists(mcap_file):
        print(f"❌ ERROR: MCAP file not found!")
        raise FileNotFoundError(f"MCAP file not found at: {mcap_file}")
    
    print(f"✅ Both files exist")

    # 2. Read Main Data
    print(f"\n📖 Reading Excel file...")
    df = pd.read_excel(main_file, engine="openpyxl")
    
    print(f"✅ Excel file loaded successfully")
    print(f"📊 Total rows BEFORE filtering: {len(df)}")
    print(f"📊 Columns available: {df.columns.tolist()}")

    # 3. Check if Cooldown Setting column exists
    if 'Cooldown Setting' not in df.columns:
        print(f"❌ ERROR: 'Cooldown Setting' column not found!")
        print(f"Available columns: {df.columns.tolist()}")
        raise ValueError("'Cooldown Setting' column not found in the Excel file")
    
    print(f"\n🔍 Cooldown Setting Column Analysis:")
    print(f"   Data type: {df['Cooldown Setting'].dtype}")
    print(f"   Unique values: {sorted(df['Cooldown Setting'].unique())}")
    print(f"   Value counts:")
    print(df['Cooldown Setting'].value_counts().sort_index())
    
    # Check if requested cooldown exists in data
    available_cooldowns = df['Cooldown Setting'].unique()
    print(f"\n🔍 Cooldown Validation:")
    print(f"   Requested: {cooldown_weeks} (type: {type(cooldown_weeks)})")
    print(f"   Available in data: {sorted(available_cooldowns)}")
    print(f"   Is requested cooldown in data? {cooldown_weeks in available_cooldowns}")
    
    # Filter for the specific cooldown weeks
    print(f"\n🔍 Applying cooldown filter: {cooldown_weeks}")
    df_before_filter = len(df)
    df = df[df['Cooldown Setting'] == cooldown_weeks].copy()
    df_after_filter = len(df)
    
    print(f"📊 Rows BEFORE cooldown filter: {df_before_filter}")
    print(f"📊 Rows AFTER cooldown filter: {df_after_filter}")
    print(f"📊 Rows removed: {df_before_filter - df_after_filter}")
    
    if df.empty:
        print(f"\n⚠️  WARNING: No data found for cooldown weeks: {cooldown_weeks}")
        print(f"   This means the filter returned 0 rows!")
        print(f"   Available cooldown values: {sorted(available_cooldowns)}")
        return df  # Return empty dataframe

    # 4. Rename columns to match expected names
    print(f"\n🔄 Column Renaming:")
    column_mapping = {}
    
    # Map Symbol column
    if 'Symbol' in df.columns:
        column_mapping['Symbol'] = 'symbol'
    elif 'symbol' not in df.columns:
        raise ValueError("Neither 'Symbol' nor 'symbol' column found")
    
    # Map Sector column
    if 'Sector' in df.columns:
        column_mapping['Sector'] = 'sector'
    elif 'sector' not in df.columns:
        raise ValueError("Neither 'Sector' nor 'sector' column found")
    
    # Map Duration column
    if 'Duration' in df.columns:
        column_mapping['Duration'] = 'duration'
    elif 'duration' not in df.columns:
        raise ValueError("Neither 'Duration' nor 'duration' column found")
    
    # Map 12-Month % column
    if '12-Month %' in df.columns:
        column_mapping['12-Month %'] = '12-month %'
    elif '12-month %' not in df.columns:
        raise ValueError("Neither '12-Month %' nor '12-month %' column found")
    
    # Map Breakout Date column
    if 'Breakout Date' in df.columns:
        column_mapping['Breakout Date'] = 'breakout date'
    elif 'breakout date' not in df.columns:
        raise ValueError("Neither 'Breakout Date' nor 'breakout date' column found")
    
    # Apply column mapping
    if column_mapping:
        df = df.rename(columns=column_mapping)
        print(f"   Renamed columns: {column_mapping}")
    else:
        print(f"   No column renaming needed")

    # 5. Read & Process Mcap Data
    print(f"\n📖 Reading MCAP file...")
    mcap_df = pd.read_csv(mcap_file)
    print(f"✅ MCAP file loaded: {len(mcap_df)} rows")

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

    # Assign Categories based on Market Cap value
    def get_category(mcap_value):
        if pd.isna(mcap_value):
            return "Micro"
        if mcap_value >= 550000:  # 5,50,000 lakhs = 55,000 Cr
            return "Mega"
        if mcap_value >= 55000:  # 55,000 lakhs = 5,500 Cr
            return "Large"
        if mcap_value >= 30000:  # 30,000 lakhs = 3,000 Cr
            return "Mid"
        if mcap_value >= 5000:   # 5,000 lakhs = 500 Cr
            return "Small"
        return "Micro"

    mcap_df["mcap_category"] = mcap_df["Market Capitalisation"].apply(get_category)

    # Create a mapping dictionary: Symbol -> Category
    mcap_map = dict(zip(mcap_df["NSE Symbol"], mcap_df["mcap_category"]))

    # 6. Merge Category into Main DataFrame
    print(f"\n🔗 Merging MCAP categories...")
    df["mcap_category"] = df["symbol"].map(mcap_map).fillna("Micro")
    
    print(f"📊 MCAP Category Distribution:")
    print(df["mcap_category"].value_counts())

    # 7. FILTER OUT MICROCAP STOCKS
    rows_before_mcap_filter = len(df)
    df = df[df["mcap_category"] != "Micro"]
    print(f"\n🔍 MCAP Filter Applied:")
    print(f"   Rows before removing Microcap: {rows_before_mcap_filter}")
    print(f"   Rows after removing Microcap: {len(df)}")
    print(f"   Rows removed: {rows_before_mcap_filter - len(df)}")

    # 8. General Cleaning
    print(f"\n🧹 Data Cleaning:")
    df["12-month %"] = pd.to_numeric(df["12-month %"], errors="coerce")
    df["duration"] = pd.to_numeric(df["duration"], errors="coerce")
    df["breakout date"] = pd.to_datetime(df["breakout date"], errors="coerce")

    # Remove invalid rows
    rows_before_cleaning = len(df)
    df = df.dropna(subset=["12-month %", "duration", "breakout date"])
    print(f"   Rows before cleaning: {rows_before_cleaning}")
    print(f"   Rows after cleaning: {len(df)}")
    print(f"   Invalid rows removed: {rows_before_cleaning - len(df)}")
    
    # Final statistics
    print(f"\n📊 FINAL DATASET STATISTICS:")
    print(f"   Total rows: {len(df)}")
    print(f"   Cooldown weeks: {cooldown_weeks}")
    if len(df) > 0:
        print(f"   Duration range: {df['duration'].min():.1f} - {df['duration'].max():.1f} weeks")
        print(f"   12-month % range: {df['12-month %'].min():.1f}% - {df['12-month %'].max():.1f}%")
        print(f"   Date range: {df['breakout date'].min()} to {df['breakout date'].max()}")
        print(f"   Sectors: {df['sector'].nunique()} unique")
    
    print(f"{'='*80}\n")
    return df


class DateRangeView(APIView):
    """Returns the min and max dates available in the dataset"""

    def get(self, request):
        try:
            print(f"\n{'='*80}")
            print(f"📅 DATE RANGE VIEW - API CALLED")
            print(f"{'='*80}\n")
            
            # Get cooldown weeks from query params, default to 52
            cooldown_weeks = int(request.query_params.get("cooldown_weeks", 52))
            
            # Validate cooldown weeks range
            if cooldown_weeks < 20 or cooldown_weeks > 104:
                return Response({"error": "Cooldown weeks must be between 20 and 104"}, status=400)
            
            print(f"   Cooldown weeks: {cooldown_weeks}")
            
            df = get_merged_data(cooldown_weeks=cooldown_weeks)
            
            if df.empty or 'breakout date' not in df.columns:
                print("⚠️  No date data available")
                return Response({
                    "min_date": None,
                    "max_date": None
                })
            
            min_date = df['breakout date'].min()
            max_date = df['breakout date'].max()
            
            # Convert to string format YYYY-MM-DD
            min_date_str = min_date.strftime('%Y-%m-%d') if pd.notna(min_date) else None
            max_date_str = max_date.strftime('%Y-%m-%d') if pd.notna(max_date) else None
            
            print(f"✅ Date Range Found:")
            print(f"   Min date: {min_date_str}")
            print(f"   Max date: {max_date_str}")
            print(f"{'='*80}\n")
            
            return Response({
                "min_date": min_date_str,
                "max_date": max_date_str
            })
            
        except Exception as e:
            print(f"❌ ERROR in DateRangeView: {e}")
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=500)


class SectorListView(APIView):
    """Returns a list of unique sectors for the dropdown"""

    def get(self, request):
        try:
            print(f"\n{'='*80}")
            print(f"🌐 SECTOR LIST VIEW - API CALLED")
            print(f"{'='*80}\n")
            
            # Use default cooldown of 52 for sector list
            df = get_merged_data(cooldown_weeks=52)
            sectors = sorted(df["sector"].astype(str).unique().tolist())
            
            print(f"✅ Returning {len(sectors)} sectors")
            print(f"   Sectors: {sectors}\n")
            
            return Response(sectors)
        except Exception as e:
            print(f"❌ ERROR in SectorListView: {e}")
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=500)


class DashboardDataView(APIView):
    """Returns the filtered graph data"""

    def get(self, request):
        try:
            print(f"\n{'='*80}")
            print(f"📊 DASHBOARD DATA VIEW - API CALLED")
            print(f"{'='*80}")
            
            # Get cooldown weeks from query params, default to 52
            cooldown_weeks_str = request.query_params.get("cooldown_weeks", "52")
            print(f"🔍 Raw cooldown_weeks from request: '{cooldown_weeks_str}' (type: {type(cooldown_weeks_str)})")
            
            try:
                cooldown_weeks = int(cooldown_weeks_str)
                print(f"✅ Converted to int: {cooldown_weeks}")
            except ValueError as e:
                print(f"❌ Failed to convert cooldown_weeks to int: {e}")
                return Response({"error": f"Invalid cooldown_weeks value: {cooldown_weeks_str}"}, status=400)
            
            # Validate cooldown weeks range
            if cooldown_weeks < 20 or cooldown_weeks > 104:
                print(f"❌ Cooldown weeks out of range: {cooldown_weeks}")
                return Response({"error": "Cooldown weeks must be between 20 and 104"}, status=400)
            
            print(f"\n📋 REQUEST PARAMETERS:")
            print(f"   Cooldown weeks: {cooldown_weeks}")
            print(f"   Start date: {request.query_params.get('start_date', 'Not set')}")
            print(f"   End date: {request.query_params.get('end_date', 'Not set')}")
            print(f"   Sector: {request.query_params.get('sector', 'Not set')}")
            print(f"   MCAP: {request.query_params.get('mcap', 'Not set')}")
            
            df = get_merged_data(cooldown_weeks=cooldown_weeks)

            if df.empty:
                print("⚠️  No data after get_merged_data - returning empty array")
                return Response([])

            # --- APPLY FILTERS ---
            print(f"\n🔍 APPLYING FILTERS:")

            # 1. Date Range Filter
            start_date = request.query_params.get("start_date")
            end_date = request.query_params.get("end_date")

            if start_date:
                df = df[df["breakout date"] >= pd.to_datetime(start_date)]
                print(f"   After start_date filter ({start_date}): {len(df)} rows")
            if end_date:
                df = df[df["breakout date"] <= pd.to_datetime(end_date)]
                print(f"   After end_date filter ({end_date}): {len(df)} rows")

            # 2. Sector Filter
            sector = request.query_params.get("sector")
            if sector and sector != "All":
                df = df[df["sector"] == sector]
                print(f"   After sector filter ({sector}): {len(df)} rows")

            # 3. Mcap Category Filter
            mcap_cat = request.query_params.get("mcap")
            if mcap_cat and mcap_cat != "All":
                df = df[df["mcap_category"] == mcap_cat]
                print(f"   After mcap filter ({mcap_cat}): {len(df)} rows")

            # --- PROCESS GRAPH DATA ---
            print(f"\n📈 PROCESSING GRAPH DATA:")

            # Filter for Success (>= 20%)
            success_df = df[df["12-month %"] >= 20].copy()
            print(f"   Success companies (>=20%): {len(success_df)} rows")

            if success_df.empty:
                print("⚠️  No successful companies after filtering - returning empty array")
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
            
            print(f"\n✅ RESPONSE SUMMARY:")
            print(f"   Duration groups: {len(response_data)}")
            print(f"   Total data points: {sum(sum(entry[label] for label in labels) for entry in response_data)}")
            if len(response_data) > 0:
                print(f"   Duration range: {response_data[0]['duration']} - {response_data[-1]['duration']} weeks")
            print(f"{'='*80}\n")
            
            return Response(response_data)

        except Exception as e:
            print(f"\n❌ ERROR in DashboardDataView:")
            print(f"   Error message: {e}")
            import traceback
            traceback.print_exc()
            print(f"{'='*80}\n")
            return Response({"error": str(e)}, status=500)


class KPIDataView(APIView):
    """Returns KPI metrics based on filtered data"""

    def get(self, request):
        try:
            print(f"\n{'='*80}")
            print(f"📊 KPI DATA VIEW - API CALLED")
            print(f"{'='*80}")
            
            # Get cooldown weeks from query params, default to 52
            cooldown_weeks_str = request.query_params.get("cooldown_weeks", "52")
            print(f"🔍 Raw cooldown_weeks from request: '{cooldown_weeks_str}' (type: {type(cooldown_weeks_str)})")
            
            try:
                cooldown_weeks = int(cooldown_weeks_str)
                print(f"✅ Converted to int: {cooldown_weeks}")
            except ValueError as e:
                print(f"❌ Failed to convert cooldown_weeks to int: {e}")
                return Response({"error": f"Invalid cooldown_weeks value: {cooldown_weeks_str}"}, status=400)
            
            # Validate cooldown weeks range
            if cooldown_weeks < 20 or cooldown_weeks > 104:
                print(f"❌ Cooldown weeks out of range: {cooldown_weeks}")
                return Response({"error": "Cooldown weeks must be between 20 and 104"}, status=400)
            
            print(f"\n📋 REQUEST PARAMETERS:")
            print(f"   Cooldown weeks: {cooldown_weeks}")
            print(f"   Start date: {request.query_params.get('start_date', 'Not set')}")
            print(f"   End date: {request.query_params.get('end_date', 'Not set')}")
            print(f"   Sector: {request.query_params.get('sector', 'Not set')}")
            print(f"   MCAP: {request.query_params.get('mcap', 'Not set')}")
            
            df = get_merged_data(cooldown_weeks=cooldown_weeks)

            if df.empty:
                print("⚠️  No data after get_merged_data - returning default KPIs")
                return Response({
                    "total_samples": 0,
                    "most_profitable": {"name": "N/A", "return": 0},
                    "average_duration": 0,
                    "success_rate": 0
                })

            # --- APPLY FILTERS ---
            print(f"\n🔍 APPLYING FILTERS:")
            
            start_date = request.query_params.get("start_date")
            end_date = request.query_params.get("end_date")

            if start_date:
                df = df[df["breakout date"] >= pd.to_datetime(start_date)]
                print(f"   After start_date filter ({start_date}): {len(df)} rows")
            if end_date:
                df = df[df["breakout date"] <= pd.to_datetime(end_date)]
                print(f"   After end_date filter ({end_date}): {len(df)} rows")

            sector = request.query_params.get("sector")
            if sector and sector != "All":
                df = df[df["sector"] == sector]
                print(f"   After sector filter ({sector}): {len(df)} rows")

            mcap_cat = request.query_params.get("mcap")
            if mcap_cat and mcap_cat != "All":
                df = df[df["mcap_category"] == mcap_cat]
                print(f"   After mcap filter ({mcap_cat}): {len(df)} rows")

            # --- CALCULATE KPIs ---
            print(f"\n📊 CALCULATING KPIs:")
            
            total_samples = len(df)
            print(f"   Total samples: {total_samples}")
            
            # Most profitable stock
            if total_samples > 0:
                most_profitable = df.loc[df["12-month %"].idxmax()]
                most_profitable_name = most_profitable.get("symbol", "N/A")
                most_profitable_return = round(most_profitable["12-month %"], 2)
                print(f"   Most profitable: {most_profitable_name} ({most_profitable_return}%)")
            else:
                most_profitable_name = "N/A"
                most_profitable_return = 0
                print(f"   Most profitable: N/A (no data)")

            # Average duration
            avg_duration = round(df["duration"].mean(), 1) if total_samples > 0 else 0
            print(f"   Average duration: {avg_duration} weeks")

            # Average success rate (average return percentage of all companies)
            success_rate = round(df["12-month %"].mean(), 1) if total_samples > 0 else 0
            print(f"   Average return: {success_rate}%")

            kpi_response = {
                "total_samples": total_samples,
                "most_profitable": {
                    "name": most_profitable_name,
                    "return": most_profitable_return
                },
                "average_duration": avg_duration,
                "success_rate": success_rate
            }
            
            print(f"\n✅ KPI RESPONSE:")
            print(f"   {kpi_response}")
            print(f"{'='*80}\n")

            return Response(kpi_response)

        except Exception as e:
            print(f"\n❌ ERROR in KPIDataView:")
            print(f"   Error message: {e}")
            import traceback
            traceback.print_exc()
            print(f"{'='*80}\n")
            return Response({"error": str(e)}, status=500)