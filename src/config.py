import os
from functools import lru_cache

class Settings:
    """アプリケーション設定管理クラス"""
    # 基本設定
    PROJECT_ID: str = os.getenv("GCP_PROJECT_ID", "")
    SHEET_ID: str = os.getenv("SHEET_ID", "") # 出力先スプレッドシートID
    SHEET_NAME: str = os.getenv("SHEET_NAME", "Result_Output")
    
    # スコアリング設定
    SCORE_MULTIPLIER: float = 10.0
    KEYWORD_BONUS: float = 2.0
    
    # 評価キーワード
    KEYWORDS_POSITIVE: list[str] = ["積極性", "貢献", "リーダーシップ", "達成"]
    KEYWORDS_NEGATIVE: list[str] = ["不安", "不満", "受動的"]

@lru_cache()
def get_settings() -> Settings:
    """設定インスタンスをキャッシュして返却"""
    return Settings()
