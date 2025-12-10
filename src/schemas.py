from pydantic import BaseModel, Field, field_validator
from datetime import datetime

class AnalysisRequest(BaseModel):
    """リクエストボディのスキーマ定義"""
    timestamp: str = Field(..., description="フォーム送信日時")
    name: str = Field(..., description="回答者名")
    answers: list[str] = Field(default_factory=list, description="分析対象の回答リスト")

    @field_validator('answers')
    @classmethod
    def filter_empty_answers(cls, v: list[str]) -> list[str]:
        """空文字やNoneを除外してクレンジング"""
        return [text for text in v if text and text.strip()]

class AnalysisResult(BaseModel):
    """分析結果のスキーマ定義"""
    processed_at: datetime = Field(default_factory=datetime.now)
    full_text: str
    sentiment_score: float
    final_score: float
