import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from analytics.models import TradingData
from ingest_data import get_mcap_map

def update_mcap():
    mcap_map = get_mcap_map()
    
    # We will update rows in batches by symbol to be efficient
    symbols = TradingData.objects.values_list('symbol', flat=True).distinct()
    
    print(f"Updating MCAP categories for {len(symbols)} distinct symbols...")
    
    for symbol in symbols:
        new_mcap = mcap_map.get(symbol, "Micro")
        if new_mcap:
            # We don't delete "Micro" currently, but we can set them
            # or skip if we want. The original ingest skipped Micro.
            if new_mcap == "Micro":
                # Let's see if we should delete or just ignore
                # Actually during ingest, Micro was skipped. So 
                # any symbol now marked Micro should perhaps be deleted 
                # or just set to Micro. Let's set it to Micro for now unless
                # you prefer deleting. I'll just set it.
                pass
            TradingData.objects.filter(symbol=symbol).update(mcap_category=new_mcap)
            
    print("Update complete!")

if __name__ == "__main__":
    update_mcap()
