import functions_framework
from flask import Request, jsonify
from pydantic import ValidationError

from src.schemas import AnalysisRequest, AnalysisResult
from src.services import SentimentService
from src.adapters import SheetAdapter

# インスタンスの初期化（コールドスタート対策でグローバルに配置）
sentiment_service = SentimentService()
# Note: SheetAdapterは接続維持等のためリクエスト毎、あるいは適宜初期化を検討
# 今回はシンプルにここで初期化（認証処理が走るため注意）
sheet_adapter = SheetAdapter()

@functions_framework.http
def analyze_submission(request: Request):
    """
    Cloud Functions エントリーポイント
    """
    try:
        # 1. リクエストのパースとバリデーション
        request_json = request.get_json(silent=True)
        if not request_json:
            return jsonify({"error": "Invalid JSON"}), 400
            
        data = AnalysisRequest(**request_json)

        # テキストがない場合は早期リターン
        if not data.answers:
            print(f"Skipped: No text content for {data.name}")
            return jsonify({"status": "skipped", "reason": "No content"}), 200

        # 2. ビジネスロジック実行
        raw_sentiment, final_score, full_text = sentiment_service.analyze(data.answers)
        
        result = AnalysisResult(
            full_text=full_text,
            sentiment_score=raw_sentiment,
            final_score=final_score
        )

        # 3. 結果の保存
        sheet_adapter.append_result(data, result)

        print(f"Success: {data.name} (Score: {final_score})")
        return jsonify({"status": "success", "score": final_score}), 200

    except ValidationError as e:
        print(f"Validation Error: {e}")
        return jsonify({"error": "Validation Error", "details": e.errors()}), 422
    except Exception as e:
        print(f"Internal Error: {e}")
        return jsonify({"error": "Internal Server Error"}), 500
