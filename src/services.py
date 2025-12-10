from google.cloud import language_v1
from src.config import get_settings

settings = get_settings()

class SentimentService:
    """感情分析とスコアリングを担当するドメインサービス"""

    def __init__(self):
        # クライアントの初期化（実際はDIコンテナを使うとテスト容易性が増すが、今回は簡易化）
        self.client = language_v1.LanguageServiceClient()

    def analyze(self, texts: list[str]) -> tuple[float, float, str]:
        """
        テキストリストを結合して分析し、スコアを算出する
        Returns: (raw_sentiment, final_score, full_text)
        """
        full_text = " ".join(texts)
        
        # テキストが空の場合のガード
        if not full_text:
            return 0.0, 0.0, ""

        # 1. Google NL APIによる分析
        document = language_v1.Document(
            content=full_text, 
            type_=language_v1.Document.Type.PLAIN_TEXT
        )
        response = self.client.analyze_sentiment(request={'document': document})
        sentiment_score = response.document_sentiment.score

        # 2. 独自スコアリングロジック
        bonus = self._calculate_keyword_bonus(full_text)
        final_score = (sentiment_score * settings.SCORE_MULTIPLIER) + bonus

        return sentiment_score, final_score, full_text

    def _calculate_keyword_bonus(self, text: str) -> float:
        """キーワードに基づくボーナススコア計算"""
        bonus = 0.0
        for word in settings.KEYWORDS_POSITIVE:
            if word in text:
                bonus += settings.KEYWORD_BONUS
        
        for word in settings.KEYWORDS_NEGATIVE:
            if word in text:
                bonus -= settings.KEYWORD_BONUS
        return bonus
