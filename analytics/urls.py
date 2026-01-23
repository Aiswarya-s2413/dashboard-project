from django.urls import path
from .views import DashboardDataView, SectorListView

urlpatterns = [
    path('chart-data/', DashboardDataView.as_view(), name='chart-data'),
    path('sectors/', SectorListView.as_view(), name='sectors'),
]