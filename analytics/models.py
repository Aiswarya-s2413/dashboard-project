from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Avg, Max, Count, Q
from .models import TradingData
import pandas as pd
from django.db import models
import math

class DateRangeView(APIView):
    """Returns min and max dates for the specific selected file/cooldown from Database"""
    def get(self, request):
        try:
            holding_weeks = int(request.query_params.get("weeks", 52))
            cooldown = int(request.query_params.get("cooldown_weeks", 52))
            
            queryset = TradingData.objects.filter(
                holding_weeks=holding_weeks,
                cooldown_setting=cooldown
            )
            
            if not queryset.exists():
                return Response({"min_date": None, "max_date": None})
            
            stats = queryset.aggregate(
                min_date=models.Min('breakout_date'), 
                max_date=models.Max('breakout_date')
            )

            return Response({
                "min_date": stats['min_date'].strftime('%Y-%m-%d') if stats['min_date'] else None,
                "max_date": stats['max_date'].strftime('%Y-%m-%d') if stats['max_date'] else None
            })
        except Exception as e:
            return Response({"min_date": None, "max_date": None})

class SectorListView(APIView):
    """Returns unique sectors from the database"""
    def get(self, request):
        sectors = TradingData.objects.values_list('sector', flat=True).distinct().order_by('sector')
        return Response(list(sectors))

class DashboardDataView(APIView):
    """Returns the filtered graph data using Database queries"""
    def get(self, request):
        try:
            holding_weeks = int(request.query_params.get("weeks", 52))
            cooldown = int(request.query_params.get("cooldown_weeks", 52))
            
            queryset = TradingData.objects.filter(
                holding_weeks=holding_weeks,
                cooldown_setting=cooldown
            )

            # Apply UI Filters
            start = request.query_params.get("start_date")
            end = request.query_params.get("end_date")
            if start: queryset = queryset.filter(breakout_date__gte=start)
            if end: queryset = queryset.filter(breakout_date__lte=end)
            
            sector = request.query_params.get("sector")
            if sector and sector != "All": queryset = queryset.filter(sector=sector)

            mcap = request.query_params.get("mcap")
            if mcap and mcap != "All": queryset = queryset.filter(mcap_category=mcap)

            # Filter for Success (>= 20%)
            success_data = queryset.filter(return_percentage__gte=20).values(
                'duration', 'return_percentage'
            )

            if not success_data.exists():
                return Response([])

            df = pd.DataFrame(list(success_data))
            df["duration_rounded"] = df["duration"].round().astype(int)
            
            bins = [20, 40, 60, 80, 100, float("inf")]
            labels = ["20-40%", "40-60%", "60-80%", "80-100%", ">100%"]
            df["range"] = pd.cut(df["return_percentage"], bins=bins, labels=labels, right=False)

            chart_data = df.groupby(["duration_rounded", "range"]).size().unstack(fill_value=0)
            
            response_data = []
            for dur, row in chart_data.iterrows():
                entry = {"duration": dur}
                for lbl in labels:
                    entry[lbl] = int(row.get(lbl, 0))
                response_data.append(entry)

            return Response(sorted(response_data, key=lambda x: x["duration"]))
        except Exception as e:
            return Response({"error": str(e)}, status=500)

class KPIDataView(APIView):
    """Returns KPI metrics based on filtered data within the selected date range"""
    def get(self, request):
        start_date = request.GET.get('start_date')
        end_date = request.GET.get('end_date')
        sector = request.GET.get('sector', 'All')
        mcap = request.GET.get('mcap', 'All')
        cooldown_weeks = request.GET.get('cooldown_weeks')
        weeks = request.GET.get('weeks')
        
        # Start with all data
        queryset = TradingData.objects.all()
        
        # Apply required filters - these must always be applied
        if cooldown_weeks:
            queryset = queryset.filter(cooldown_setting=int(cooldown_weeks))
        
        if weeks:
            queryset = queryset.filter(holding_weeks=int(weeks))
        
        # Apply date range filter - calculate with whatever data exists in this range
        # This will filter to only dates within the range, even if some dates are missing
        if start_date and end_date:
            queryset = queryset.filter(breakout_date__range=[start_date, end_date])
        
        # Apply sector filter
        if sector and sector != 'All':
            queryset = queryset.filter(sector=sector)
        
        # Apply market cap filter
        if mcap and mcap != 'All':
            queryset = queryset.filter(mcap_category=mcap)
        
        # Now calculate with whatever data we have (could be 0 records)
        count = queryset.count()
        
        if count == 0:
            # No data matching the filters - return zeros
            return Response({
                'total_samples': 0,
                'most_profitable': None,
                'average_duration': 0,
                'success_rate': 0,
            })
        
        # Calculate metrics safely with available data
        total_duration = queryset.aggregate(models.Sum('duration'))['duration__sum'] or 0
        successful = queryset.filter(return_percentage__gt=0).count()
        most_profitable = queryset.order_by('-return_percentage').first()
        
        return Response({
            'total_samples': count,
            'most_profitable': {
                'name': most_profitable.company or most_profitable.symbol,
                'return': round(most_profitable.return_percentage, 2)
            } if most_profitable else None,
            'average_duration': round(total_duration / count, 1),
            'success_rate': round((successful / count) * 100, 1),
        })