from django.urls import path
from .views import DashboardDataView, SectorListView, KPIDataView

urlpatterns = [
    path('chart-data/', DashboardDataView.as_view(), name='chart-data'),
    path('sectors/', SectorListView.as_view(), name='sectors'),
    path('kpi-data/', KPIDataView.as_view(), name='kpi-data'),
]