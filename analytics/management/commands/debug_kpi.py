from django.core.management.base import BaseCommand
from analytics.views import KPIDataView
from django.test import RequestFactory
from analytics.models import TradingData
from django.db.models import Min, Max

class Command(BaseCommand):
    help = 'Debugs KPIDataView by running a simulated request with DB data'

    def handle(self, *args, **options):
        self.stdout.write("Debugging KPIDataView...")
        
        # 1. Check if ANY data exists
        total_count = TradingData.objects.count()
        self.stdout.write(f"Total TradingData records: {total_count}")
        
        if total_count == 0:
            self.stdout.write(self.style.ERROR("No data in DB!"))
            return

        # 2. Get a valid sample to build query params
        sample = TradingData.objects.first()
        min_date = TradingData.objects.aggregate(Min('breakout_date'))['breakout_date__min']
        max_date = TradingData.objects.aggregate(Max('breakout_date'))['breakout_date__max']
        
        self.stdout.write(f"Sample params from DB: weeks={sample.holding_weeks}, cooldown={sample.cooldown_setting}")
        self.stdout.write(f"Date range in DB: {min_date} to {max_date}")

        # 3. Construct Request
        factory = RequestFactory()
        
        # Simulate the request exactly as frontend might send it
        # We start with the full range
        params = {
            'start_date': min_date.strftime('%Y-%m-%d'),
            'end_date': max_date.strftime('%Y-%m-%d'),
            'weeks': sample.holding_weeks,
            'cooldown_weeks': sample.cooldown_setting,
            'sector': 'All', 
            'mcap': 'All'
        }
        
        path = '/api/kpi-data/'
        request = factory.get(path, params)
        
        # 4. Invoke View
        view = KPIDataView.as_view()
        try:
            response = view(request)
            self.stdout.write("Response Status: " + str(response.status_code))
            self.stdout.write("Response Data: " + str(response.data))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Exception calling view: {e}"))
            import traceback
            traceback.print_exc()
