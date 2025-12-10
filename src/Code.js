const CONFIG = {
  // Cloud FunctionsのエンドポイントURL
  API_URL: 'https://your-region-project.cloudfunctions.net/analyze_submission',
  // フォーム設定
  FORM: {
    TARGET_COLUMN_INDICES: [6, 7, 8, 9, 10, 15, 16, 17],
    COL_TIMESTAMP: 0,
    COL_NAME: 1
  }
};

function onFormSubmit(e) {
  if (!e || !e.values) return;

  const rowData = e.values;
  
  // ペイロード作成
  const payload = {
    timestamp: rowData[CONFIG.FORM.COL_TIMESTAMP],
    name: rowData[CONFIG.FORM.COL_NAME] || "No Name",
    answers: CONFIG.FORM.TARGET_COLUMN_INDICES.map(index => rowData[index])
  };

  // Cloud Functionsへの送信（OIDC認証付き）
  postToCloudFunctions(payload);
}

function postToCloudFunctions(payload) {
  try {
    // IDトークン（OIDC）の取得: これが関数の実行権限の証明書になります
    const token = ScriptApp.getIdentityToken();
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      headers: {
        'Authorization': `Bearer ${token}`
      },
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(CONFIG.API_URL, options);
    console.log(`Response Code: ${response.getResponseCode()}`);
    console.log(`Response Body: ${response.getContentText()}`);
    
  } catch (err) {
    console.error(`Error calling Cloud Functions: ${err.message}`);
  }
}
