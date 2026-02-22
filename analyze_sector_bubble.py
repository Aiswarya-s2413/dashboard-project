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

def analyze_sector_bubble():
    print(f"Fetching Sector Bubble Data (Performance vs Duration vs Samples)...\n")
    
    data_response = get_json(f"{BASE_URL}/sector-performance/")
    
    if not data_response:
        print("Failed to fetch data.")
        return

    sectors_data = data_response.get('data', [])
    
    # Flatten data to bubbles
    bubbles = []
    for item in sectors_data:
        sector = item.get('sector', 'Unknown')
        for mcap in ['Mega', 'Large', 'Mid', 'Small']:
            if item.get(mcap) is not None:
                success_rate = item.get(mcap, 0)
                samples = item.get('sample_counts', {}).get(mcap, 0)
                duration = item.get('avg_durations', {}).get(mcap, 0)
                
                if samples > 0: # Only analyze if there are samples, matching chart logic
                    bubbles.append({
                        'sector': sector,
                        'mcap': mcap,
                        'success_rate': success_rate,
                        'samples': samples,
                        'duration': duration
                    })

    # CATEGORY 1: "Fast & Furious" (High Success > 75%, Short Duration < 60 weeks, Samples >= 5)
    fast_wins = [b for b in bubbles if b['success_rate'] >= 75 and b['duration'] < 60 and b['samples'] >= 5]
    fast_wins.sort(key=lambda x: x['success_rate'], reverse=True)

    # CATEGORY 2: "Patient Compounders" (High Success > 75%, Long Duration > 80 weeks, Samples >= 5)
    slow_wins = [b for b in bubbles if b['success_rate'] >= 75 and b['duration'] > 80 and b['samples'] >= 3]
    slow_wins.sort(key=lambda x: x['success_rate'], reverse=True)

    # CATEGORY 3: "High Conviction Anchors" (High Success > 70%, Massive Samples > 15)
    anchors = [b for b in bubbles if b['success_rate'] >= 70 and b['samples'] >= 15]
    anchors.sort(key=lambda x: x['samples'], reverse=True)

    # CATEGORY 4: "The Danger Zone" (Success < 50%, Samples >= 5)
    danger = [b for b in bubbles if b['success_rate'] < 50 and b['samples'] >= 5]
    danger.sort(key=lambda x: x['success_rate'])

    print(f"{'Sector':<35} {'Cap':<10} {'Success':<10} {'Duration':<12} {'Samples':<10}")
    print("=" * 80)
    
    print("\n🚀 FAST & FURIOUS (High Win Rate + Quick Returns < 60w)\n")
    print(f"{'Sector':<35} {'Cap':<10} {'Success':<10} {'Duration':<12} {'Samples':<10}")
    print("-" * 80)
    for b in fast_wins:
         print(f"{b['sector']:<35} {b['mcap']:<10} {b['success_rate']:.1f}%{'':<5} {b['duration']:.1f} wks{'':<4} {b['samples']}")

    print("\n⏳ PATIENT COMPOUNDERS (High Win Rate + Long Hold > 80w)\n")
    print(f"{'Sector':<35} {'Cap':<10} {'Success':<10} {'Duration':<12} {'Samples':<10}")
    print("-" * 80)
    for b in slow_wins:
         print(f"{b['sector']:<35} {b['mcap']:<10} {b['success_rate']:.1f}%{'':<5} {b['duration']:.1f} wks{'':<4} {b['samples']}")

    print("\n⚓ HIGH CONVICTION ANCHORS (Proven Reliability > 15 Samples)\n")
    print(f"{'Sector':<35} {'Cap':<10} {'Success':<10} {'Duration':<12} {'Samples':<10}")
    print("-" * 80)
    for b in anchors:
         print(f"{b['sector']:<35} {b['mcap']:<10} {b['success_rate']:.1f}%{'':<5} {b['duration']:.1f} wks{'':<4} {b['samples']}")

    print("\n⚠️ DANGER ZONE (Avoid These Laggards)\n")
    print(f"{'Sector':<35} {'Cap':<10} {'Success':<10} {'Duration':<12} {'Samples':<10}")
    print("-" * 80)
    for b in danger:
         print(f"{b['sector']:<35} {b['mcap']:<10} {b['success_rate']:.1f}%{'':<5} {b['duration']:.1f} wks{'':<4} {b['samples']}")

if __name__ == "__main__":
    analyze_sector_bubble()
