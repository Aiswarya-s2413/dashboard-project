from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Avg, Max, Count, Q, Sum, Min
from .models import TradingData
import pandas as pd
from django.db import models
import math
from django.core.cache import cache
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page

class DateRangeView(APIView):
    """Returns min and max dates for the specific selected file/cooldown from Database"""
    
    def get(self, request):
        try:
            holding_weeks = int(request.query_params.get("weeks", 52))
            cooldown = int(request.query_params.get("cooldown_weeks", 52))
            
            # Use cache to avoid repeated DB queries
            cache_key = f"date_range_{holding_weeks}_{cooldown}"
            cached_result = cache.get(cache_key)
            
            if cached_result:
                return Response(cached_result)
            
            queryset = TradingData.objects.filter(
                holding_weeks=holding_weeks,
                cooldown_setting=cooldown
            )
            
            if not queryset.exists():
                return Response({"min_date": None, "max_date": None})
            
            # Optimize: Use only() to fetch only required fields
            stats = queryset.aggregate(
                min_date=Min('breakout_date'), 
                max_date=Max('breakout_date')
            )

            result = {
                "min_date": stats['min_date'].strftime('%Y-%m-%d') if stats['min_date'] else None,
                "max_date": stats['max_date'].strftime('%Y-%m-%d') if stats['max_date'] else None
            }
            
            # Cache for 5 minutes
            cache.set(cache_key, result, 300)
            
            return Response(result)
            
        except Exception as e:
            print(f"Error in DateRangeView: {str(e)}")
            return Response({"min_date": None, "max_date": None})

class SectorListView(APIView):
    """Returns unique sectors from the database"""
    
    def get(self, request):
        # Cache sector list for 10 minutes (rarely changes)
        cache_key = "sectors_list"
        cached_sectors = cache.get(cache_key)
        
        if cached_sectors:
            return Response(cached_sectors)
        
        # Optimize: Use distinct() on database level
        sectors = list(
            TradingData.objects.values_list('sector', flat=True)
            .distinct()
            .order_by('sector')
        )
        
        # Cache for 10 minutes
        cache.set(cache_key, sectors, 600)
        
        return Response(sectors)

class DashboardDataView(APIView):
    """Returns the filtered graph data using Database queries"""
    
    def get(self, request):
        try:
            holding_weeks = int(request.query_params.get("weeks", 52))
            cooldown = int(request.query_params.get("cooldown_weeks", 52))
            
            # Base queryset with index optimization
            queryset = TradingData.objects.filter(
                holding_weeks=holding_weeks,
                cooldown_setting=cooldown
            )

            # Apply UI Filters
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

            # Filter for Success (>= 20%) - use only() to fetch only needed fields
            success_data = queryset.filter(
                return_percentage__gte=20
            ).only('duration', 'return_percentage').values(
                'duration', 'return_percentage'
            )

            if not success_data.exists():
                return Response([])

            # Convert to list immediately to close DB connection
            success_list = list(success_data)
            
            df = pd.DataFrame(success_list)
            df["duration_rounded"] = df["duration"].round().astype(int)
            
            bins = [20, 40, 60, 80, 100, float("inf")]
            labels = ["20-40%", "40-60%", "60-80%", "80-100%", ">100%"]
            df["range"] = pd.cut(df["return_percentage"], bins=bins, labels=labels, right=False)

            chart_data = df.groupby(["duration_rounded", "range"]).size().unstack(fill_value=0)
            
            response_data = []
            for dur, row in chart_data.iterrows():
                entry = {"duration": int(dur)}
                for lbl in labels:
                    entry[lbl] = int(row.get(lbl, 0))
                response_data.append(entry)

            return Response(sorted(response_data, key=lambda x: x["duration"]))
            
        except Exception as e:
            print(f"Error in DashboardDataView: {str(e)}")
            return Response({"error": str(e)}, status=500)

class KPIDataView(APIView):
    """Returns KPI metrics based on filtered data within the selected date range"""
    
    def get(self, request):
        try:
            start_date = request.GET.get('start_date')
            end_date = request.GET.get('end_date')
            sector = request.GET.get('sector', 'All')
            mcap = request.GET.get('mcap', 'All')
            cooldown_weeks = request.GET.get('cooldown_weeks')
            weeks = request.GET.get('weeks')
            
            # Start with all data
            queryset = TradingData.objects.all()
            
            # Apply required filters
            if cooldown_weeks:
                queryset = queryset.filter(cooldown_setting=int(cooldown_weeks))
            
            if weeks:
                queryset = queryset.filter(holding_weeks=int(weeks))
            
            # Apply date range filter
            if start_date and end_date:
                queryset = queryset.filter(breakout_date__range=[start_date, end_date])
            
            # Apply sector filter
            if sector and sector != 'All':
                queryset = queryset.filter(sector=sector)
            
            # Apply market cap filter
            if mcap and mcap != 'All':
                queryset = queryset.filter(mcap_category=mcap)
            
            # Single aggregate query for efficiency
            aggregated = queryset.aggregate(
                count=Count('id'),
                total_duration=Sum('duration'),
                successful=Count('id', filter=Q(return_percentage__gt=0))
            )
            
            count = aggregated['count'] or 0
            
            if count == 0:
                return Response({
                    'total_samples': 0,
                    'most_profitable': None,
                    'average_duration': 0,
                    'success_rate': 0,
                })
            
            # Separate query for most profitable (exclude NaN/NULL values)
            # Filter for valid return_percentage values first
            most_profitable = queryset.filter(
                return_percentage__isnull=False
            ).exclude(
                return_percentage=float('nan')
            ).only(
                'company', 'symbol', 'return_percentage'
            ).order_by('-return_percentage').first()
            
            total_duration = aggregated['total_duration'] or 0
            successful = aggregated['successful'] or 0
            
            # Calculate most_profitable_return
            most_profitable_return = 0
            if most_profitable and most_profitable.return_percentage is not None:
                # Additional safety check for NaN
                if not math.isnan(most_profitable.return_percentage):
                    most_profitable_return = round(most_profitable.return_percentage, 2)
            
            return Response({
                'total_samples': count,
                'most_profitable': {
                    'name': most_profitable.company or most_profitable.symbol,
                    'return': most_profitable_return
                } if most_profitable else None,
                'average_duration': round(total_duration / count, 1) if count > 0 else 0,
                'success_rate': round((successful / count) * 100, 1) if count > 0 else 0,
            })
            
        except Exception as e:
            print(f"Error in KPIDataView: {str(e)}")
            return Response({
                'total_samples': 0,
                'most_profitable': None,
                'average_duration': 0,
                'success_rate': 0,
            }, status=500)

class SectorPerformanceView(APIView):
    """Returns success rate by Sector and Market Cap (Fixed 52w/52c, No Micro)"""
    
    def get(self, request):
        try:
            # Fixed Parameters
            holding_weeks = 52
            cooldown = 52
            
            # Cache key
            cache_key = f"sector_performance_{holding_weeks}_{cooldown}"
            cached_data = cache.get(cache_key)
            if cached_data:
                return Response(cached_data)

            # Base Query: Fixed params, Exclude Micro
            queryset = TradingData.objects.filter(
                holding_weeks=holding_weeks,
                cooldown_setting=cooldown
            ).exclude(mcap_category='Micro')

            # Get necessary fields
            data = list(queryset.values('sector', 'mcap_category', 'return_percentage'))
            
            if not data:
                return Response([])

            df = pd.DataFrame(data)
            
            # Calculate Success (return > 0) per Sector & Mcap
            # Group by Sector and Mcap
            grouped = df.groupby(['sector', 'mcap_category'])
            
            # Calculate metrics
            sector_mcap_stats = grouped.agg(
                total_count=('return_percentage', 'count'),
                success_count=('return_percentage', lambda x: (x > 0).sum())
            ).reset_index()
            
            # Calculate percentage
            sector_mcap_stats['success_rate'] = (sector_mcap_stats['success_count'] / sector_mcap_stats['total_count'] * 100).round(1)
            
            # Pivot primarily on Sector, with columns for each Mcap
            pivot_df = sector_mcap_stats.pivot(index='sector', columns='mcap_category', values='success_rate').fillna(0)
            
            # Format for Recharts
            response_data = []
            for sector, row in pivot_df.iterrows():
                entry = {"sector": sector}
                # Add each cap value
                for mcap in row.index:
                    entry[mcap] = row[mcap]
                response_data.append(entry)
            
            # Sort by sector name or maybe average success rate? Let's sort alpha by sector for now
            response_data.sort(key=lambda x: x['sector'])
            
            # Cache for 10 minutes
            cache.set(cache_key, response_data, 600)
            
            return Response(response_data)
            
        except Exception as e:
            print(f"Error in SectorPerformanceView: {str(e)}")
            return Response({"error": str(e)}, status=500)