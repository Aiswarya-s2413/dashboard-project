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

def analyze_sector_performance():
    print(f"Fetching Sector Performance Data...\n")
    
    data_response = get_json(f"{BASE_URL}/sector-performance/")
    
    if not data_response:
        print("Failed to fetch data.")
        return

    sectors_data = data_response.get('data', [])
    overall_confidence = data_response.get('overall_confidence', 0)
    relationship_strength = data_response.get('relationship_strength', '-')
    total_samples = data_response.get('total_samples', 0)

    print(f"Overall Report Summary:")
    print(f"Total Samples: {total_samples}")
    print(f"Relationship Strength: {relationship_strength}")
    print(f"Overall Confidence Score: {overall_confidence}\n")

    print("-" * 160)
    print(f"{'Sector':<35} {'Mega':<20} {'Large':<20} {'Mid':<20} {'Small':<20} {'Score/Avg':<10}")
    print(f"{'':<35} {'%(Count)':<20} {'%(Count)':<20} {'%(Count)':<20} {'%(Count)':<20} {'(0-100)':<10}")
    print("-" * 160)

    processed_data = []
    
    for item in sectors_data:
        sector = item.get('sector', 'Unknown')
        
        mega_rate = item.get('Mega', 0)
        large_rate = item.get('Large', 0)
        mid_rate = item.get('Mid', 0)
        small_rate = item.get('Small', 0)
        
        counts = item.get('sample_counts', {})
        mega_count = counts.get('Mega', 0)
        large_count = counts.get('Large', 0)
        mid_count = counts.get('Mid', 0)
        small_count = counts.get('Small', 0)
        
        # Calculate Average (Simple average of 4 caps as per UI)
        avg_rate = (mega_rate + large_rate + mid_rate + small_rate) / 4
        
        processed_data.append({
            'sector': sector,
            'mega': (mega_rate, mega_count),
            'large': (large_rate, large_count),
            'mid': (mid_rate, mid_count),
            'small': (small_rate, small_count),
            'avg': avg_rate
        })

    # Sort by Average Descending
    processed_data.sort(key=lambda x: x['avg'], reverse=True)

    # Print Top 25
    print("TOP 25 PERFORMERS (Broadest Success):")
    for d in processed_data[:25]:
        mega_str = f"{d['mega'][0]:.0f}%({d['mega'][1]})" if d['mega'][1] > 0 else "-"
        large_str = f"{d['large'][0]:.0f}%({d['large'][1]})" if d['large'][1] > 0 else "-"
        mid_str = f"{d['mid'][0]:.0f}%({d['mid'][1]})" if d['mid'][1] > 0 else "-"
        small_str = f"{d['small'][0]:.1f}%({d['small'][1]})" if d['small'][1] > 0 else "-"
        
        print(f"{d['sector']:<35} {mega_str:<20} {large_str:<20} {mid_str:<20} {small_str:<20} {d['avg']:.1f}")

    print("\n" + "-" * 160 + "\n")

    # Print a few Bottom ones
    print("BOTTOM 5 PERFORMERS:")
    for d in processed_data[-5:]:
        mega_str = f"{d['mega'][0]:.0f}%({d['mega'][1]})" if d['mega'][1] > 0 else "-"
        large_str = f"{d['large'][0]:.0f}%({d['large'][1]})" if d['large'][1] > 0 else "-"
        mid_str = f"{d['mid'][0]:.0f}%({d['mid'][1]})" if d['mid'][1] > 0 else "-"
        small_str = f"{d['small'][0]:.1f}%({d['small'][1]})" if d['small'][1] > 0 else "-"
        
        print(f"{d['sector']:<35} {mega_str:<20} {large_str:<20} {mid_str:<20} {small_str:<20} {d['avg']:.1f}")

if __name__ == "__main__":
    analyze_sector_performance()
