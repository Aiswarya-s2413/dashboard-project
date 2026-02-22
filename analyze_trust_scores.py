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

def analyze_trust_scores():
    print(f"Fetching Sector Trust Score Data...\n")
    
    data_response = get_json(f"{BASE_URL}/sector-performance/")
    
    if not data_response:
        print("Failed to fetch data.")
        return

    data = data_response.get('data', [])
    
    # Process Trust Scores
    # Score = Sum of confidence scores across 4 caps
    # Max Score = 4.0 (1.0 * 4)
    
    ranked_sectors = []
    
    for item in data:
        sector = item.get('sector', 'Unknown')
        scores = item.get('confidence_scores', {})
        mega = scores.get('Mega', 0)
        large = scores.get('Large', 0)
        mid = scores.get('Mid', 0)
        small = scores.get('Small', 0)
        
        total_score = mega + large + mid + small
        
        # Count heavily weighted caps (> 0.7 confidence)
        high_conviction_caps = sum(1 for s in [mega, large, mid, small] if s >= 0.7)
        
        ranked_sectors.append({
            'sector': sector,
            'total': total_score,
            'mega': mega,
            'large': large,
            'mid': mid,
            'small': small,
            'high_conviction_count': high_conviction_caps
        })

    # Sort by Total Score
    ranked_sectors.sort(key=lambda x: x['total'], reverse=True)

    print(f"{'Sector':<35} {'Total Score':<12} {'Mega':<8} {'Large':<8} {'Mid':<8} {'Small':<8} {'Verdict'}")
    print("=" * 100)
    
    # 1. ELITE TRUST (Score > 2.5) - Broad market play
    print("\n🏆 ELITE TIER (Broadest Market Trust across Caps)\n")
    print(f"{'Sector':<35} {'Score':<8} {'Mega':<8} {'Large':<8} {'Mid':<8} {'Small':<8}")
    print("-" * 90)
    for r in ranked_sectors:
        if r['total'] >= 2.5:
             print(f"{r['sector']:<35} {r['total']:.2f}{'':<4} {r['mega']:.2f}{'':<4} {r['large']:.2f}{'':<4} {r['mid']:.2f}{'':<4} {r['small']:.2f}")

    # 2. MID/SMALL CAP SPECIALISTS (High Conviction in lower caps, Total < 2.5)
    print("\n💎 MID/SMALL CAP KINGS (High Trust in Growth Caps)\n")
    print(f"{'Sector':<35} {'Score':<8} {'Mid':<8} {'Small':<8}")
    print("-" * 75)
    mid_small_kings = [r for r in ranked_sectors if r['total'] < 2.5 and (r['mid'] > 0.8 or r['small'] > 0.8)]
    mid_small_kings.sort(key=lambda x: max(x['mid'], x['small']), reverse=True)
    
    for r in mid_small_kings[:15]:
         print(f"{r['sector']:<35} {r['total']:.2f}{'':<4} {r['mid']:.2f}{'':<4} {r['small']:.2f}")

    # 3. STATISTICAL GHOSTS (Low Trust < 1.0)
    print("\n👻 STATISTICAL GHOSTS (Avoid - Insufficient Data/Trust)\n")
    ghosts = [r for r in ranked_sectors if r['total'] < 1.0]
    for r in ghosts[:10]:
         print(f"{r['sector']:<35} {r['total']:.2f} (Poor Data Depth)")

if __name__ == "__main__":
    analyze_trust_scores()
