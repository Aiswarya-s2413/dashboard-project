from django.urls import path
from .views import DashboardDataView, SectorListView, KPIDataView, DateRangeView, SectorPerformanceView, ConfidenceTrendView, SectorDurationView

urlpatterns = [
    path('chart-data/', DashboardDataView.as_view(), name='chart-data'),
    path('sectors/', SectorListView.as_view(), name='sectors'),
    path('kpi-data/', KPIDataView.as_view(), name='kpi-data'),
    path('date-range/', DateRangeView.as_view(), name='date-range'),
    path('sector-performance/', SectorPerformanceView.as_view(), name='sector-performance'),
    path('confidence-trend/', ConfidenceTrendView.as_view(), name='confidence-trend'),
    path('sector-duration/', SectorDurationView.as_view(), name='sector-duration'),
]