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
import numpy as np
# scipy not available, using manual calculation



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

def calculate_cramers_v(df):
    """
    Calculates Cramer's V statistic for categorical association.
    V = sqrt(chi2 / (n * (min(cols, rows) - 1)))
    """
    if df.empty or len(df.sector.unique()) < 2:
        return 0.0
    
    # Create contingency table
    contingency = pd.crosstab(df['sector'], df['mcap_category'])
    
    # Observed values
    obs = contingency.values
    n = obs.sum()
    if n == 0:
        return 0.0
        
    # Expected values
    row_sums = obs.sum(axis=1)
    col_sums = obs.sum(axis=0)
    expected = np.outer(row_sums, col_sums) / n
    
    # Avoid division by zero
    expected = np.where(expected == 0, 1e-9, expected)
    
    # Chi-square statistic
    chi2 = np.sum((obs - expected)**2 / expected)
    
    phi2 = chi2 / n
    r, k = contingency.shape
    
    # Correction for bias (simplified version of Bergsma and Wicher)
    phi2_corr = max(0, phi2 - ((k-1)*(r-1))/(n-1))
    r_corr = r - ((r-1)**2)/(n-1)
    k_corr = k - ((k-1)**2)/(n-1)
    
    denom = min((k_corr-1), (r_corr-1))
    if denom <= 0:
        return 0.0
        
    return np.sqrt(phi2_corr / denom)


def calculate_sample_confidence(count, threshold=30):
    """
    Returns a confidence score (0-1) based on sample size.
    Uses a logarithmic scale to reach 1.0 at threshold.
    """
    if count <= 0:
        return 0.0
    if count >= threshold:
        return 1.0
    
    # Logarithmic progression: 1 sample = small confidence, threshold = 1.0
    return round(math.log(count + 1) / math.log(threshold + 1), 2)


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
            data_list = list(queryset.values('sector', 'mcap_category', 'return_percentage', 'duration'))
            
            if not data_list:
                return Response({
                    "data": [],
                    "overall_confidence": 0,
                    "relationship_strength": "Very Weak",
                    "total_samples": 0
                })

            df = pd.DataFrame(data_list)
            
            # Calculate Overall Confidence (Cramer's V)
            cv = calculate_cramers_v(df)
            overall_confidence = round(cv * 100, 1)
            
            # Relationship Strength Interpretation
            if cv > 0.5: strength = "Very Strong"
            elif cv > 0.3: strength = "Strong"
            elif cv > 0.15: strength = "Moderate"
            elif cv > 0.05: strength = "Weak"
            else: strength = "Very Weak"

            # Group by Sector and Mcap
            grouped = df.groupby(['sector', 'mcap_category'])
            
            # Calculate metrics
            stats = grouped.agg(
                total_count=('return_percentage', 'count'),
                success_count=('return_percentage', lambda x: (x > 0).sum()),
                avg_duration=('duration', 'mean')
            ).reset_index()
            
            # Calculate percentage and confidence
            stats['success_rate'] = (stats['success_count'] / stats['total_count'] * 100).round(1)
            stats['confidence'] = stats['total_count'].apply(calculate_sample_confidence)
            stats['avg_duration'] = stats['avg_duration'].round(1)
            
            # Pivot primarily on Sector
            pivot_success = stats.pivot(index='sector', columns='mcap_category', values='success_rate').fillna(0)
            pivot_counts = stats.pivot(index='sector', columns='mcap_category', values='total_count').fillna(0)
            pivot_conf = stats.pivot(index='sector', columns='mcap_category', values='confidence').fillna(0)
            pivot_dur = stats.pivot(index='sector', columns='mcap_category', values='avg_duration').fillna(0)
            
            # Format for Recharts
            response_data = []
            for sector, row in pivot_success.iterrows():
                entry = {
                    "sector": sector,
                    "sample_counts": {},
                    "confidence_scores": {},
                    "avg_durations": {}
                }
                # Add each cap value, count, and confidence
                for mcap in row.index:
                    entry[mcap] = row[mcap]
                    entry["sample_counts"][mcap] = int(pivot_counts.loc[sector, mcap])
                    entry["confidence_scores"][mcap] = float(pivot_conf.loc[sector, mcap])
                    entry["avg_durations"][mcap] = float(pivot_dur.loc[sector, mcap])
                response_data.append(entry)
            
            # Sort alpha by sector
            response_data.sort(key=lambda x: x['sector'])
            
            final_response = {
                "data": response_data,
                "overall_confidence": overall_confidence,
                "relationship_strength": strength,
                "total_samples": len(df)
            }
            
            # Cache for 10 minutes
            cache.set(cache_key, final_response, 600)
            
            return Response(final_response)

        except Exception as e:
            print(f"Error in SectorPerformanceView: {str(e)}")
            return Response({"error": str(e)}, status=500)

class ConfidenceTrendView(APIView):
    """Returns overall confidence and success rate across different durations"""
    def get(self, request):
        try:
            durations = [26, 52, 78, 104, 156, 208]
            cooldown = 52 # Fixed default
            
            # Cache check
            cache_key = f"confidence_trend_{cooldown}"
            cached_data = cache.get(cache_key)
            if cached_data:
                return Response(cached_data)
                
            trend_data = []
            
            for d in durations:
                queryset = TradingData.objects.filter(
                    holding_weeks=d,
                    cooldown_setting=cooldown
                ).exclude(mcap_category='Micro')
                
                data_list = list(queryset.values('sector', 'mcap_category', 'return_percentage'))
                if not data_list:
                    continue
                    
                df = pd.DataFrame(data_list)
                cv = calculate_cramers_v(df)
                
                # Calculate average success rate
                avg_success = (df['return_percentage'] > 0).mean() * 100
                
                trend_data.append({
                    "duration": d,
                    "confidence": round(cv * 100, 1),
                    "success_rate": round(avg_success, 1),
                    "sample_size": len(df)
                })
                
            cache.set(cache_key, trend_data, 600)
            return Response(trend_data)
            
        except Exception as e:
            print(f"Error in ConfidenceTrendView: {str(e)}")
            return Response({"error": str(e)}, status=500)


class SectorDurationView(APIView):
    """Returns sector performance broken down by duration for bubble chart"""
    def get(self, request):
        try:
            durations = [26, 52, 78, 104, 156, 208]
            cooldown = 52  # Fixed default
            
            # Cache check
            cache_key = f"sector_duration_bubbles_{cooldown}"
            cached_data = cache.get(cache_key)
            if cached_data:
                return Response(cached_data)
            
            # Fetch all relevant data at once to minimize queries
            queryset = TradingData.objects.filter(
                holding_weeks__in=durations,
                cooldown_setting=cooldown
            ).exclude(mcap_category='Micro')
            
            data_list = list(queryset.values('sector', 'holding_weeks', 'return_percentage'))
            
            if not data_list:
                return Response([])
                
            df = pd.DataFrame(data_list)
            
            # Group by Sector and Duration
            grouped = df.groupby(['sector', 'holding_weeks'])
            
            bubble_data = []
            
            for (sector, duration), group in grouped:
                success_rate = (group['return_percentage'] > 0).mean() * 100
                sample_size = len(group)
                
                bubble_data.append({
                    "sector": sector,
                    "duration": duration,
                    "success_rate": round(success_rate, 1),
                    "sample_size": sample_size
                })
            
            # Cache for 10 minutes
            cache.set(cache_key, bubble_data, 600)
            return Response(bubble_data)
            
        except Exception as e:
            print(f"Error in SectorDurationView: {str(e)}")
            return Response({"error": str(e)}, status=500)
