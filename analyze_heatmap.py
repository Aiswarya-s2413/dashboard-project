import urllib.request
import urllib.parse
import json
import ssl

BASE_URL = "https://dashboard.aiswaryasathyan.space/api"

# Disable SSL verification
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def get_json(url):
    try:
        with urllib.request.urlopen(url, context=ctx) as response:
            if response.status == 200:
                return json.loads(response.read().decode('utf-8'))
            return None
    except Exception as e:
        return None

def analyze_heatmap():
    print(f"Fetching Sector Duration Heatmap Data...\n")
    
    data_response = get_json(f"{BASE_URL}/sector-duration/")
    
    if not data_response:
        print("Failed to fetch data.")
        return

    # Data structure: List of objects {sector, duration, success_rate, sample_size}
    data = data_response
    
    # 1. Organize by Sector
    sector_map = {}
    durations = sorted(list(set(d['duration'] for d in data)))
    
    for item in data:
        sec = item['sector']
        if sec not in sector_map:
            sector_map[sec] = {}
        sector_map[sec][item['duration']] = item

    # 2. Identification Logic
    
    # "Consistent Compounders": Green across ALL timeframes (26w -> 104w+)
    consistent = []
    
    # "Early Birds": Strong in 26-52w, Fade later
    early_birds = []
    
    # "Late Bloomers": Weak/Avg early, Strong in 104w+
    late_bloomers = []
    
    # "Red Flags": Consistently red/amber across time
    red_flags = []

    for sector, timeline in sector_map.items():
        # Get rates for key durations if available
        r26 = timeline.get(26, {}).get('success_rate')
        r52 = timeline.get(52, {}).get('success_rate')
        r104 = timeline.get(104, {}).get('success_rate')
        
        # Valid rates list for average calculation
        rates = [t['success_rate'] for t in timeline.values()]
        avg_rate = sum(rates) / len(rates) if rates else 0
        
        # Consistency Check (Min 3 data points required)
        if len(rates) >= 3:
            if all(r >= 70 for r in rates):
                consistent.append((sector, avg_rate))
            elif avg_rate < 50:
                red_flags.append((sector, avg_rate))
        
        # Trend Checks
        if r26 and r52 and r104:
            if r26 >= 75 and r52 >= 75 and r104 < 60:
                early_birds.append((sector, r26, r104))
            if r26 < 60 and r104 >= 75:
                late_bloomers.append((sector, r26, r104))

    # Print Report
    print(f"{'Sector':<35} {'26w':<8} {'52w':<8} {'78w':<8} {'104w':<8} {'156w':<8} {'208w':<8}")
    print("=" * 90)

    # Sort consistent by average rate
    consistent.sort(key=lambda x: x[1], reverse=True)
    
    print("\n🟢 CONSISTENT COMPOUNDERS (Green across the board)\n")
    for sec, avg in consistent[:15]: # Top 15
        row = sector_map[sec]
        vals = []
        for d in [26, 52, 78, 104, 156, 208]:
            item = row.get(d)
            if item:
                vals.append(f"{item['success_rate']:.0f}%")
            else:
                vals.append("-")
        print(f"{sec:<35} {vals[0]:<8} {vals[1]:<8} {vals[2]:<8} {vals[3]:<8} {vals[4]:<8} {vals[5]:<8}")

    print("\n🚀 EARLY BIRDS (Strong Start, Fades Later)\n")
    for sec, start, end in early_birds:
        row = sector_map[sec]
        vals = []
        for d in [26, 52, 78, 104, 156, 208]:
            item = row.get(d)
            if item:
                vals.append(f"{item['success_rate']:.0f}%")
            else:
                vals.append("-")
        print(f"{sec:<35} {vals[0]:<8} {vals[1]:<8} {vals[2]:<8} {vals[3]:<8} {vals[4]:<8} {vals[5]:<8}")

    print("\n🐢 LATE BLOOMERS (Needs Time > 2 Years)\n")
    for sec, start, end in late_bloomers:
        row = sector_map[sec]
        vals = []
        for d in [26, 52, 78, 104, 156, 208]:
            item = row.get(d)
            if item:
                vals.append(f"{item['success_rate']:.0f}%")
            else:
                vals.append("-")
        print(f"{sec:<35} {vals[0]:<8} {vals[1]:<8} {vals[2]:<8} {vals[3]:<8} {vals[4]:<8} {vals[5]:<8}")

    print("\n⚠️ RED FLAGS (Historically Poor Performers)\n")
    for sec, avg in red_flags:
        row = sector_map[sec]
        vals = []
        for d in [26, 52, 78, 104, 156, 208]:
            item = row.get(d)
            if item:
                vals.append(f"{item['success_rate']:.0f}%")
            else:
                vals.append("-")
        print(f"{sec:<35} {vals[0]:<8} {vals[1]:<8} {vals[2]:<8} {vals[3]:<8} {vals[4]:<8} {vals[5]:<8}")

if __name__ == "__main__":
    analyze_heatmap()
