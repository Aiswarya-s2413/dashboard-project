from django.urls import path
from .views import DashboardDataView

urlpatterns = [
    path('chart-data/', DashboardDataView.as_view(), name='chart-data'),
]