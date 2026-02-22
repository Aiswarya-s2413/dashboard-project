import urllib.request
import urllib.parse
import json
import time
import ssl

BASE_URL = "https://dashboard.aiswaryasathyan.space/api"

# Disable SSL verification
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def get_json(url, params):
    try:
        query_string = urllib.parse.urlencode(params)
        full_url = f"{url}?{query_string}"
        with urllib.request.urlopen(full_url, context=ctx) as response:
            if response.status == 200:
                return json.loads(response.read().decode('utf-8'))
            return None
    except Exception as e:
        # print(f"Error fetching {url}: {e}")
        return None

def analyze_cooldown_impact_26():
    # We'll fix the holding period to 26 weeks
    holding_weeks = 26
    cooldown_options = [20, 26, 40, 52, 60, 78, 104]
    
    print(f"Impact of Cooldown on 26-Week Holding Period Performance\n")
    print(f"{'Cooldown':<10} {'Total Samples':<15} {'Successful (>=20%)':<20} {'Success Rate (>0%)':<20} {'Avg Duration':<15} {'20-40%':<10} {'40-60%':<10} {'60-80%':<10} {'80-100%':<10} {'>100%':<10}")
    print("-" * 140)

    for cooldown in cooldown_options:
        try:
            # 1. Get Date Range
            range_params = {
                "cooldown_weeks": cooldown,
                "weeks": holding_weeks
            }
            range_data = get_json(f"{BASE_URL}/date-range/", range_params)
            
            if not range_data:
                print(f"{cooldown:<10} {'Error (No Range)':<30}")
                continue

            min_date = range_data.get("min_date")
            max_date = range_data.get("max_date")
            
            if not min_date or not max_date:
                print(f"{cooldown:<10} {'No Data (Empty Dates)':<30}")
                continue

            # 2. Get KPI Data
            params = {
                "start_date": min_date,
                "end_date": max_date,
                "sector": "All",
                "mcap": "All",
                "cooldown_weeks": cooldown,
                "weeks": holding_weeks
            }
            
            kpi_data = get_json(f"{BASE_URL}/kpi-data/", params)

            if not kpi_data:
                print(f"{cooldown:<10} {'Error (No KPI)':<30}")
                continue
            
            total_samples = kpi_data.get("total_samples", 0)
            avg_duration = kpi_data.get("average_duration", 0)
            success_rate = kpi_data.get("success_rate", 0) # This is percentage
            
            # 3. Get Chart Data
            chart_data = get_json(f"{BASE_URL}/chart-data/", params)
            
            # Aggregate chart data
            count_20_40 = 0
            count_40_60 = 0
            count_60_80 = 0
            count_80_100 = 0
            count_gt_100 = 0
            
            successful_gt20 = 0
            
            if chart_data:
                for entry in chart_data:
                    c1 = entry.get("20-40%", 0)
                    c2 = entry.get("40-60%", 0)
                    c3 = entry.get("60-80%", 0)
                    c4 = entry.get("80-100%", 0)
                    c5 = entry.get(">100%", 0)
                    
                    count_20_40 += c1
                    count_40_60 += c2
                    count_60_80 += c3
                    count_80_100 += c4
                    count_gt_100 += c5
                    
                    successful_gt20 += (c1 + c2 + c3 + c4 + c5)

            print(f"{cooldown:<10} {total_samples:<15} {successful_gt20:<20} {success_rate:<20} {avg_duration:<15} {count_20_40:<10} {count_40_60:<10} {count_60_80:<10} {count_80_100:<10} {count_gt_100:<10}")
            
            time.sleep(0.5)

        except Exception as e:
            print(f"{cooldown:<10} Error: {str(e)}")

if __name__ == "__main__":
    analyze_cooldown_impact_26()
