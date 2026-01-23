from rest_framework.views import APIView
from rest_framework.response import Response
import pandas as pd
import os
from django.conf import settings


class DashboardDataView(APIView):
    def get(self, request):
        # 1. Update the filename to your .xlsx file
        file_name = "NRB_Without_MicroCap.xlsx"
        # Look for the file in a "data" folder inside the project root:
        #   /Users/.../dashboard_project/data/NRB_Without_MicroCap.xlsx
        file_path = os.path.join(settings.BASE_DIR, "data", file_name)

        try:
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"Data file not found at: {file_path}")

            # 2. Use read_excel instead of read_csv
            # 'engine="openpyxl"' is required for .xlsx files
            df = pd.read_excel(file_path, engine="openpyxl")

            # 3. Clean Data (Same as before)
            df["12-month %"] = pd.to_numeric(df["12-month %"], errors="coerce")
            df["duration"] = pd.to_numeric(df["duration"], errors="coerce")
            df = df.dropna(subset=["12-month %", "duration"])

            # 4. Filter for Success (>= 20%)
            success_df = df[df["12-month %"] >= 20].copy()

            # 5. Round Duration
            success_df["duration_rounded"] = success_df["duration"].round().astype(int)

            # 6. Categorize Success Levels
            bins = [20, 40, 60, 80, 100, float("inf")]
            labels = ["20-40%", "40-60%", "60-80%", "80-100%", ">100%"]

            success_df["success_category"] = pd.cut(
                success_df["12-month %"], bins=bins, labels=labels, right=False
            )

            # 7. Group Data
            chart_data = (
                success_df.groupby(["duration_rounded", "success_category"])
                .size()
                .unstack(fill_value=0)
            )

            # 8. Format for Frontend
            response_data = []
            for duration, row in chart_data.iterrows():
                entry = {"duration": duration}
                for label in labels:
                    entry[label] = row.get(label, 0)
                response_data.append(entry)

            response_data.sort(key=lambda x: x["duration"])

            return Response(response_data)

        except Exception as e:
            # This helps debug if the file isn't found or format is wrong
            print(f"Error processing file: {e}")
            return Response({"error": str(e)}, status=500)
