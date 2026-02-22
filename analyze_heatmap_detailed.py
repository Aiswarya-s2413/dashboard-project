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

def analyze_heatmap_detailed():
    print(f"Fetching Sector Duration Heatmap Data (Detailed)...\n")
    
    data_response = get_json(f"{BASE_URL}/sector-duration/")
    
    if not data_response:
        print("Failed to fetch data.")
        return

    data = data_response
    
    # Organize by Sector
    sector_map = {}
    for item in data:
        sec = item['sector']
        if sec not in sector_map:
            sector_map[sec] = {}
        sector_map[sec][item['duration']] = item

    print("Analyzing Sector Performance Across Timeframes...\n")

    results = []
    
    for sector, timeline in sector_map.items():
        # Get raw data objects
        d26 = timeline.get(26, {})
        d52 = timeline.get(52, {})
        d78 = timeline.get(78, {})
        d104 = timeline.get(104, {})
        
        # Get rates (default 0)
        r26 = d26.get('success_rate', 0)
        r52 = d52.get('success_rate', 0)
        r78 = d78.get('success_rate', 0)
        r104 = d104.get('success_rate', 0)
        
        # Calculate valid average based on available data points
        rates = [t['success_rate'] for t in timeline.values()]
        avg = sum(rates) / len(rates) if rates else 0
        
        results.append({
            'sector': sector,
            'r26': r26, 'r52': r52, 'r78': r78, 'r104': r104, 
            'avg': avg,
            'raw': timeline
        })

    # Sort by Average
    results.sort(key=lambda x: x['avg'], reverse=True)
    
    # 1. 👑 ALL-WEATHER PERFORMERS (Best Avg Success)
    print("👑 ALL-WEATHER PERFORMERS (Best Avg Success across all durations)\n")
    print(f"{'Sector':<35} {'26w':<8} {'52w':<8} {'78w':<8} {'104w':<8} {'AVG':<8}")
    print("-" * 85)
    for r in results[:15]:
        def fmt(val): return f"{val:.0f}%" if val > 0 else "-"
        print(f"{r['sector']:<35} {fmt(r['r26']):<8} {fmt(r['r52']):<8} {fmt(r['r78']):<8} {fmt(r['r104']):<8} {r['avg']:.1f}%")

    # 2. ⚡ SHORT TERM KINGS (Best 26-Week Performance)
    print("\n⚡ SHORT TERM KINGS (Best 26-Week Performance)\n")
    short_term = sorted(results, key=lambda x: x['r26'], reverse=True)
    print(f"{'Sector':<35} {'26w':<8} {'52w':<8} {'78w':<8} {'AVG':<8}")
    print("-" * 75)
    for r in short_term[:10]:
        def fmt(val): return f"{val:.0f}%" if val > 0 else "-"
        print(f"{r['sector']:<35} {fmt(r['r26']):<8} {fmt(r['r52']):<8} {fmt(r['r78']):<8} {r['avg']:.1f}%")

    # 3. 🐢 LONG TERM COMPOUNDERS (Best 104-Week Performance)
    print("\n🐢 LONG TERM COMPOUNDERS (Best 104-Week Performance)\n")
    long_term = sorted(results, key=lambda x: x['r104'], reverse=True)
    print(f"{'Sector':<35} {'52w':<8} {'78w':<8} {'104w':<8} {'AVG':<8}")
    print("-" * 75)
    for r in long_term[:10]:
        def fmt(val): return f"{val:.0f}%" if val > 0 else "-"
        print(f"{r['sector']:<35} {fmt(r['r52']):<8} {fmt(r['r78']):<8} {fmt(r['r104']):<8} {r['avg']:.1f}%")
        
    # 4. 📉 FADING STARS (Strong Start 26w -> Weak Finish 104w)
    print("\n📉 FADING STARS (Starts Strong >70%, Ends Weak <50%)\n")
    faders = [r for r in results if r['r26'] >= 70 and r['r104'] > 0 and r['r104'] < 50]
    faders.sort(key=lambda x: x['r26'] - x['r104'], reverse=True)
    
    print(f"{'Sector':<35} {'26w':<8} {'104w':<8} {'Drop':<8}")
    print("-" * 65)
    if faders:
        for r in faders:
             drop = r['r26'] - r['r104']
             print(f"{r['sector']:<35} {r['r26']:.0f}%{'':<5} {r['r104']:.0f}%{'':<5} -{drop:.0f}%")
    else:
        print("No significant fading stars found based on criteria.")

if __name__ == "__main__":
    analyze_heatmap_detailed()
