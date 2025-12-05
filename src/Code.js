/**
 * ------------------------------------------------------------------
 * Google Forms Sentiment Analysis Script
 * ------------------------------------------------------------------
 * 概要:
 * Googleフォームの回答から特定のテキストを抽出し、
 * Google Natural Language APIを用いて感情分析を行います。
 * * セットアップ手順:
 * 1. スクリプトプロパティに 'GCP_API_KEY' を設定してください。
 * 2. CONFIGオブジェクト内の列定義をフォームに合わせて調整してください。
 * 3. 初回のみ setTrigger() 関数を実行してください。
 * ------------------------------------------------------------------
 */


const CONFIG = {
  // フォームの設定
  FORM: {
    // 解析対象とする列インデックス（0始まりの配列インデックス）
    // 例: [6, 7, 8, 9, 10, 15, 16, 17] のように不連続な範囲も指定可能
    TARGET_COLUMN_INDICES: [6, 7, 8, 9, 10, 15, 16, 17],
    // 基本情報の列
    COL_TIMESTAMP: 0,
    COL_NAME: 1
  },
  // 出力先設定
  DESTINATION: {
    SHEET_NAME: "Result_Output" // 日本語シート名は環境依存を避けるため英字推奨、あるいはプロパティ管理
  },
  // スコアリング設定
  SCORING: {
    MULTIPLIER: 10,
    KEYWORD_BONUS: 2
  },
  // 評価キーワード（GitHub公開用にプレースホルダーにしています）
  KEYWORDS: {
    POSITIVE: ["積極性", "貢献", "リーダーシップ", "達成"], 
    NEGATIVE: ["不安", "不満", "受動的"]
  }
};

/**
 * フォーム送信時に実行されるトリガー関数
 * @param {Object} e - イベントオブジェクト
 */
function onFormSubmit(e) {
  // 1. ガード節: 手動実行やイベントオブジェクト不備への対策
  if (!e || !e.values) {
    console.warn("イベントオブジェクトが見つかりません。フォーム送信トリガーから実行してください。");
    return;
  }

  try {
    const rowData = e.values;
    
    // 2. データ抽出
    const timestamp = rowData[CONFIG.FORM.COL_TIMESTAMP];
    const name = rowData[CONFIG.FORM.COL_NAME] || "No Name";

    // 分析対象テキストの結合（空欄を除外して結合）
    const fullText = CONFIG.FORM.TARGET_COLUMN_INDICES
      .map(index => rowData[index])
      .filter(text => text && text.trim() !== "") // 空文字や空白のみを除外
      .join(" ");

    // 3. APIコールの節約: テキストがない場合はスキップ
    if (!fullText) {
      console.log(`スキップ: ${name} さんの回答には分析対象のテキストが含まれていません。`);
      return;
    }

    // 4. 分析とスコアリング
    const analysisResult = analyzeSentimentAndScore(fullText);

    // 5. 結果の書き込み
    writeResultToSheet({
      timestamp: timestamp,
      name: name,
      fullText: fullText,
      sentiment: analysisResult.sentiment,
      score: analysisResult.score
    });

  } catch (error) {
    console.error(`予期せぬエラー: ${error.message}`);
    console.error(error.stack);
    // 実運用ではここでSlack通知やメール通知を行うことが多いです
  }
}

/**
 * 結果をシートに書き込むヘルパー関数
 * @param {Object} data - 書き込むデータのオブジェクト
 */
function writeResultToSheet(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.DESTINATION.SHEET_NAME);

  if (!sheet) {
    throw new Error(`出力先シート「${CONFIG.DESTINATION.SHEET_NAME}」が存在しません。作成してください。`);
  }

  // 配列化して追記
  sheet.appendRow([
    data.timestamp,
    data.name,
    data.fullText,
    data.sentiment,
    data.score
  ]);
  
  console.log(`処理完了: ${data.name} (Score: ${data.score})`);
}

/**
 * Natural Language API 連携およびスコア計算
 * @param {string} text - 分析対象テキスト
 * @return {Object} { sentiment: number, score: number }
 */
function analyzeSentimentAndScore(text) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GCP_API_KEY');
  
  if (!apiKey) {
    throw new Error("APIキー未設定: スクリプトプロパティ 'GCP_API_KEY' を確認してください。");
  }

  const url = `https://language.googleapis.com/v1/documents:analyzeSentiment?key=${apiKey}`;
  const payload = {
    document: {
      type: "PLAIN_TEXT",
      content: text
    },
    encodingType: "UTF8"
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const result = JSON.parse(response.getContentText());

  if (responseCode !== 200) {
    const errorMsg = result.error ? result.error.message : 'Unknown API Error';
    throw new Error(`API Error (${responseCode}): ${errorMsg}`);
  }

  // スコア計算
  const sentiment = result.documentSentiment ? result.documentSentiment.score : 0;
  const bonus = calculateKeywordBonus(text);
  
  // 精度調整: 小数点第2位などで丸める処理を入れても良い（今回はそのまま）
  const finalScore = (sentiment * CONFIG.SCORING.MULTIPLIER) + bonus;

  return { sentiment, score: finalScore };
}

/**
 * キーワード補正スコア計算
 * @param {string} text 
 * @return {number}
 */
function calculateKeywordBonus(text) {
  let bonus = 0;
  
  // 肯定キーワード
  CONFIG.KEYWORDS.POSITIVE.forEach(keyword => {
    if (text.includes(keyword)) bonus += CONFIG.SCORING.KEYWORD_BONUS;
  });

  // 否定キーワード
  CONFIG.KEYWORDS.NEGATIVE.forEach(keyword => {
    if (text.includes(keyword)) bonus -= CONFIG.SCORING.KEYWORD_BONUS;
  });

  return bonus;
}

/**
 * セットアップ用: トリガー設定
 * ※重複登録を防ぐロジック入り
 */
function setTrigger() {
  const functionName = "onFormSubmit";
  const triggers = ScriptApp.getProjectTriggers();
  
  // 既存トリガーの確認
  const isExist = triggers.some(trigger => trigger.getHandlerFunction() === functionName);

  if (isExist) {
    console.log(`トリガー '${functionName}' は既に設定済みです。`);
    return;
  }

  ScriptApp.newTrigger(functionName)
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onFormSubmit()
    .create();

  console.log(`トリガー '${functionName}' を新規作成しました。`);
}
