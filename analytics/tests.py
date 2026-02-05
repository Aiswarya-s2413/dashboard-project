from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from .models import TradingData
from datetime import date

class SparseDataCalculationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        # Create data points with gaps
        # Dates: Jan 1, Jan 5, Jan 10
        
        # Data point 1
        TradingData.objects.create(
            symbol="TEST1",
            company="Test Co 1",
            sector="Technology",
            cooldown_setting=52,
            holding_weeks=52,
            mcap_category="Large",
            breakout_date=date(2023, 1, 1),
            duration=10.0,
            return_percentage=50.0
        )
        
        # Data point 2
        TradingData.objects.create(
            symbol="TEST2",
            company="Test Co 2",
            sector="Technology",
            cooldown_setting=52,
            holding_weeks=52,
            mcap_category="Large",
            breakout_date=date(2023, 1, 5),
            duration=20.0,
            return_percentage=30.0
        )
        
        # Data point 3
        TradingData.objects.create(
            symbol="TEST3",
            company="Test Co 3",
            sector="Technology",
            cooldown_setting=52,
            holding_weeks=52,
            mcap_category="Large",
            breakout_date=date(2023, 1, 10),
            duration=30.0,
            return_percentage=-10.0
        )

    def test_kpi_calculation_with_missing_dates(self):
        """
        Verify that calculations are based only on the 3 available records
        within the range Jan 1 to Jan 10, incorrectly ignoring the missing dates.
        """
        url = reverse('kpi-data')
        
        response = self.client.get(url, {
            'start_date': '2023-01-01',
            'end_date': '2023-01-10',
            'weeks': 52,
            'cooldown_weeks': 52
        })
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Verify total samples (should be 3, ignoring missing dates)
        self.assertEqual(data['total_samples'], 3)
        
        # Verify average duration (10+20+30)/3 = 20.0
        self.assertEqual(data['average_duration'], 20.0)
        
        # Verify success rate (2 positive returns out of 3 total) -> 66.7%
        # 50.0 > 0 (Success)
        # 30.0 > 0 (Success)
        # -10.0 <= 0 (Fail)
        self.assertEqual(data['success_rate'], 66.7)
