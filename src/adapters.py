import gspread
import google.auth
from src.config import get_settings
from src.schemas import AnalysisRequest, AnalysisResult

settings = get_settings()

class SheetAdapter:
    """Google Sheetsへのデータ永続化を担当"""

    def __init__(self):
        # Cloud Functionsのデフォルト認証情報を使用
        credentials, _ = google.auth.default(
            scopes=["https://www.googleapis.com/auth/spreadsheets"]
        )
        self.client = gspread.authorize(credentials)
        self.sheet = self.client.open_by_key(settings.SHEET_ID).worksheet(settings.SHEET_NAME)

    def append_result(self, request_data: AnalysisRequest, result: AnalysisResult) -> None:
        """分析結果を行として追記"""
        row = [
            request_data.timestamp,
            request_data.name,
            result.full_text,
            result.sentiment_score,
            result.final_score
        ]
        self.sheet.append_row(row)
