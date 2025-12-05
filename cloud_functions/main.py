import os
import json
import logging
import functions_framework
from google.cloud import language_v1
from flask import Request, jsonify

# ログ設定（クラウド環境でのデバッグ用）
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 環境変数から設定を読み込む（ハードコーディングしないのが鉄則）
# GCPのCloud Functions設定画面でセットすることを想定
PROJECT_ID = os.environ.get("GCP_PROJECT_ID", "default-project")
MIN_SCORE_THRESHOLD = float(os.environ.get("MIN_SCORE_THRESHOLD", "0.0"))

@functions_framework.http
def analyze_sentiment_handler(request: Request):
    """
    Cloud Functions Entry Point
    フォームからのWebhookを受け取り、感情分析結果を返す
    """
    # 1. リクエストのバリデーション
    if request.method != "POST":
        return jsonify({"error": "Method Not Allowed"}), 405

    request_json = request.get_json(silent=True)
    if not request_json or 'text' not in request_json:
        logger.warning("Invalid request: 'text' field missing.")
        return jsonify({"error": "Bad Request: 'text' field is required"}), 400

    text_content = request_json['text']
    user_name = request_json.get('name', 'Anonymous')

    try:
        # 2. ビジネスロジックの実行
        result = _analyze_text(text_content)
        
        # 3. ログ出力（本来はここでDBやBigQueryに保存する）
        logger.info(f"Analyzed sentiment for {user_name}: Score={result['score']}")

        return jsonify({
            "status": "success",
            "data": {
                "name": user_name,
                "sentiment_score": result['score'],
                "sentiment_magnitude": result['magnitude'],
                "is_positive": result['score'] > MIN_SCORE_THRESHOLD
            }
        }), 200

    except Exception as e:
        logger.error(f"Internal Error: {str(e)}")
        return jsonify({"error": "Internal Server Error"}), 500

def _analyze_text(text: str) -> dict:
    """
    Google Natural Language API を呼び出すヘルパー関数
    """
    client = language_v1.LanguageServiceClient()
    document = language_v1.Document(
        content=text, 
        type_=language_v1.Document.Type.PLAIN_TEXT
    )
    
    # APIコール
    response = client.analyze_sentiment(request={'document': document})
    sentiment = response.document_sentiment

    return {
        "score": sentiment.score,
        "magnitude": sentiment.magnitude
    }
