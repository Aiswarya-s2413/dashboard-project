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
    """Returns KPI metrics from the Database"""
    def get(self, request):
        try:
            holding_weeks = int(request.query_params.get("weeks", 52))
            cooldown = int(request.query_params.get("cooldown_weeks", 52))
            
            queryset = TradingData.objects.filter(
                holding_weeks=holding_weeks,
                cooldown_setting=cooldown
            )

            # Apply same UI Filters
            start = request.query_params.get("start_date")
            end = request.query_params.get("end_date")
            if start: 
                queryset = queryset.filter(breakout_date__gte=start)
            if end: 
                queryset = queryset.filter(breakout_date__lte=end)
            
            sector = request.query_params.get("sector")
            if sector and sector != "All": 
                queryset = queryset.filter(sector=sector)

            mcap = request.query_params.get("mcap")
            if mcap and mcap != "All": 
                queryset = queryset.filter(mcap_category=mcap)

            # Filter for successful trades only (>= 20% return)
            queryset = queryset.filter(return_percentage__gte=20)

            total = queryset.count()
            
            # Handle empty queryset
            if total == 0:
                return Response({
                    "total_samples": 0, 
                    "most_profitable": {"name": "N/A", "return": 0}, 
                    "average_duration": 0, 
                    "success_rate": 0
                })
            
            # Get best performing stock
            best_stock = queryset.order_by('-return_percentage').first()
            
            # Get all values as lists to calculate averages manually
            durations = list(queryset.values_list('duration', flat=True))
            returns = list(queryset.values_list('return_percentage', flat=True))
            
            # Calculate averages manually (avoids NaN issues)
            avg_duration = sum(durations) / len(durations) if durations else 0
            avg_return = sum(returns) / len(returns) if returns else 0
            
            return Response({
                "total_samples": total,
                "most_profitable": {
                    "name": best_stock.symbol, 
                    "return": round(float(best_stock.return_percentage), 2)
                },
                "average_duration": round(float(avg_duration), 1),
                "success_rate": round(float(avg_return), 1)
            })
            
        except Exception as e:
            # Log error and return safe defaults
            import traceback
            print(f"KPI Error: {str(e)}")
            print(traceback.format_exc())
            return Response({
                "total_samples": 0, 
                "most_profitable": {"name": "N/A", "return": 0}, 
                "average_duration": 0, 
                "success_rate": 0
            })