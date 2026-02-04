from django.db import models

class TradingData(models.Model):
    # Core identifying info
    symbol = models.CharField(max_length=50, db_index=True)
    company = models.CharField(max_length=255, null=True, blank=True)
    sector = models.CharField(max_length=100, db_index=True)
    
    # Filter-specific fields (Indexed for speed)
    cooldown_setting = models.IntegerField(db_index=True)  # 20-104
    holding_weeks = models.IntegerField(db_index=True)     # 5, 10, 52...
    mcap_category = models.CharField(max_length=20, db_index=True) # Mega, Large, etc.
    
    # Date and Metrics
    breakout_date = models.DateField(db_index=True)
    duration = models.FloatField()
    return_percentage = models.FloatField()  # This is the 12-Month %

    class Meta:
        # This makes sure the database can handle queries on these combined filters very fast
        indexes = [
            models.Index(fields=['holding_weeks', 'cooldown_setting']),
        ]

    def __str__(self):
        return f"{self.symbol} ({self.holding_weeks}w / {self.cooldown_setting}c)"
