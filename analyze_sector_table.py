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

def get_json(url):
    try:
        with urllib.request.urlopen(url, context=ctx) as response:
            if response.status == 200:
                return json.loads(response.read().decode('utf-8'))
            return None
    except Exception as e:
        # print(f"Error fetching {url}: {e}")
        return None

def analyze_sector_table_reports():
    print(f"Fetching Sector Performance Data (Table View Analysis)...\n")
    
    data_response = get_json(f"{BASE_URL}/sector-performance/")
    
    if not data_response:
        print("Failed to fetch data.")
        return

    sectors_data = data_response.get('data', [])

    print(f"{'Sector':<35} {'Cap':<10} {'Success %':<10} {'Trust Score':<12} {'Samples':<10} {'Verdict'}")
    print("-" * 100)

    # We want to highlight specific high-value, high-trust opportunities found in the table
    # Logic: Look for success rate > 75% AND Trust Score > 0.5 (Strong/Medium confidence)
    
    high_conviction_plays = []
    
    for item in sectors_data:
        sector = item.get('sector', 'Unknown')
        
        for mcap in ['Mega', 'Large', 'Mid', 'Small']:
            rate = item.get(mcap, 0)
            trust = item.get('confidence_scores', {}).get(mcap, 0)
            samples = item.get('sample_counts', {}).get(mcap, 0)
            
            # Filter for "High Quality"
            if rate >= 75 and samples >= 5:
                verdict = "STRONG BUY" if rate >= 85 else "BUY"
                high_conviction_plays.append({
                    'sector': sector,
                    'mcap': mcap,
                    'rate': rate,
                    'trust': trust,
                    'samples': samples,
                    'verdict': verdict
                })

    # Sort by Rate Descending
    high_conviction_plays.sort(key=lambda x: x['rate'], reverse=True)

    print("\nHIGH CONVICTION OPPORTUNITIES (Rate >= 75%, Samples >= 5)\n")
    print(f"{'Sector':<35} {'Cap':<10} {'Success %':<15} {'Trust (0-1)':<15} {'Samples':<10}")
    print("-" * 90)
    
    for play in high_conviction_plays:
        print(f"{play['sector']:<35} {play['mcap']:<10} {play['rate']:.1f}%{'':<9} {play['trust']:.2f}{'':<9} {play['samples']}")
    
    print("\n" + "="*90 + "\n")
    
    # Analyze "Traps" - High Trust (lots of samples) but Low Success (< 50%)
    traps = []
    for item in sectors_data:
        sector = item.get('sector', 'Unknown')
        for mcap in ['Mega', 'Large', 'Mid', 'Small']:
            rate = item.get(mcap, 0)
            samples = item.get('sample_counts', {}).get(mcap, 0)
            
            if rate < 50 and samples >= 5:
                traps.append({
                    'sector': sector,
                    'mcap': mcap,
                    'rate': rate,
                    'samples': samples
                })
    
    traps.sort(key=lambda x: x['rate'])
    
    print("SECTOR TRAPS (Avoid - High Volume, Low Success < 50%)\n")
    print(f"{'Sector':<35} {'Cap':<10} {'Success %':<15} {'Samples':<10}")
    print("-" * 90)
    for trap in traps:
        print(f"{trap['sector']:<35} {trap['mcap']:<10} {trap['rate']:.1f}%{'':<9} {trap['samples']}")

if __name__ == "__main__":
    analyze_sector_table_reports()
