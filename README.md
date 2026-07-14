# ACTIS Visa Support LP

行政書士法人アクティスの在留資格・ビザサポート LP です。

LP 本体は Firebase Hosting で静的配信し、フォーム処理は Google Apps Script（GAS）で行います。

## 公開構成

- `public/` が Firebase Hosting の公開ディレクトリです。
- `public/index.html` は `/jp/` へリダイレクトします。
- `public/jp/` が日本語 LP です。
- `public/en/` が英語 LP です。
- `public/jp/thanks.html` と `public/en/thanks.html` がサイト側のサンクスページです。
- PHP ファイルは Firebase Hosting には配置しません。Hosting は静的ファイルのみを配信します。

Firebase 設定:

- プロジェクト: `actis-visa-support-lp`
- Hosting 公開ディレクトリ: `public`
- 設定ファイル: `firebase.json`, `.firebaserc`

## フォーム送信の流れ

フォームはサイトから GAS に送信しますが、ユーザーに見せるサンクスページはこのサイト側で管理します。

現在の流れ:

1. ユーザーが `/jp/` または `/en/` のフォームを送信します。
2. `public/jp/js/contact.js` または `public/en/js/contact.js` が必須項目を検証します。
3. フォームは hidden iframe 経由で GAS に POST されます。
4. GAS が問い合わせ内容をスプレッドシートへ記録し、管理者通知メールと自動返信メールを送信します。
5. GAS は処理完了後、小さな HTML を返し、`window.top.postMessage(...)` でサイト側へ完了通知します。
6. サイト側 JS が通知を受け取り、`/jp/thanks.html` または `/en/thanks.html` へ遷移します。
7. `postMessage` が届かない場合でも、iframe の読み込み完了を検知してサイト側サンクスページへ遷移するフォールバックがあります。

サンクスページと「トップページへ戻る」ボタンは、必ずサイト側で管理します。GAS 側の HTML をユーザー向けサンクスページとして使わないでください。

## GAS URL を変更するとき

GAS の Web アプリを再デプロイして `/exec` URL が変わったら、以下の 2 ファイルの `form action` を更新します。

- `public/jp/index.html`
- `public/en/index.html`

検索する文字列:

```html
<form action="https://script.google.com/macros/s/.../exec"
```

`action` には最新の GAS Web アプリ `/exec` URL を設定します。

## 変更箇所早見表

- GAS の URL が変わった場合: `public/jp/index.html` と `public/en/index.html` の `form action` を変更します。
- サンクスページの文言を変える場合: `public/jp/thanks.html` と `public/en/thanks.html` を変更します。
- サンクスページへの遷移制御を変える場合: `public/jp/js/contact.js` と `public/en/js/contact.js` を変更します。
- メール文面や送信先を変える場合: GAS 側の `sendAdminMail_` と `sendAutoReply_` を変更します。
- シート名や保存項目を変える場合: GAS 側の `SHEET_NAME` と `saveInquiryToSheet_` を変更します。

## サイト側 JavaScript

フォーム制御の JavaScript は以下です。

- `public/jp/js/contact.js`
- `public/en/js/contact.js`

担当している処理:

- 必須項目チェック
- プライバシーポリシー同意チェック
- hidden iframe の作成
- `site_origin` を GAS に渡す
- GAS の完了通知を待つ
- `/jp/thanks.html` または `/en/thanks.html` へ遷移する
- iframe が読み込まれても `postMessage` が届かない場合にフォールバックで遷移する

GAS 完了通知の送信元として許可している origin:

- `https://script.google.com`
- `https://script.googleusercontent.com`

## GAS の役割

GAS はバックエンド処理だけを担当します。

- フォーム項目を受け取る
- 必須項目を検証する
- GAS に紐づいたスプレッドシートへ問い合わせ内容を保存する
- 管理者通知メールを送信する
- フォーム送信者へ自動返信メールを送信する
- `window.top.postMessage(...)` を呼ぶ小さな HTML を返す

GAS はユーザー向けのサンクスページを持ちません。

## GAS コード

このコードは、スプレッドシートに紐づいた Apps Script で使う前提です。

`SpreadsheetApp.getActiveSpreadsheet()` を使っているため、スタンドアロンの Apps Script で使う場合は `SpreadsheetApp.openById(...)` に変更してください。

```javascript
var SHEET_NAME = 'inquiries';

function doPost(e) {
  var siteOrigin = '';

  try {
    var p = e && e.parameter ? e.parameter : {};

    var lang = normalizeLang_(p.lang);
    siteOrigin = validateSiteOrigin_(p.site_origin);

    var data = {
      name: (p.name_1 || '').trim(),
      phone: (p.phone || '').trim(),
      email: (p.mail_address || '').trim(),
      residence: (p.residence || '').trim(),
      contents: (p.contents || '').trim(),
      privacy: (p.privacy || '').trim()
    };

    validateRequired_(data, lang);
    saveInquiryToSheet_(data, lang);
    sendAdminMail_(data, lang);
    sendAutoReply_(data, lang);

    return resultHtml_(siteOrigin, {
      status: 'success'
    });
  } catch (error) {
    Logger.log({
      stage: 'fatal',
      message: String(error),
      stack: error && error.stack ? error.stack : ''
    });

    return resultHtml_(siteOrigin || 'https://actis-visa-support-lp.web.app', {
      status: 'error',
      message: error && error.message ? error.message : 'Unexpected error'
    });
  }
}

function normalizeLang_(lang) {
  return lang === 'en' ? 'en' : 'jp';
}

function validateSiteOrigin_(origin) {
  var value = (origin || '').trim();

  if (!/^https:\/\/[^\s]+$/i.test(value)) {
    throw new Error('Invalid site_origin.');
  }

  return value;
}

function validateRequired_(data, lang) {
  if (!data.name || !data.phone || !data.email || !data.privacy) {
    throw new Error(
      lang === 'en' ? 'Required fields are missing.' : '必須項目が不足しています。'
    );
  }

  var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(data.email)) {
    throw new Error(
      lang === 'en' ? 'Invalid email address.' : 'メールアドレスの形式が正しくありません。'
    );
  }
}

function saveInquiryToSheet_(data, lang) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error('No bound spreadsheet found.');
  }

  var sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'created_at',
      'lang',
      'name',
      'phone',
      'email',
      'residence',
      'contents',
      'privacy'
    ]);
  }

  sheet.appendRow([
    new Date(),
    lang,
    data.name,
    data.phone,
    data.email,
    data.residence,
    data.contents,
    data.privacy
  ]);
}

function sendAdminMail_(data, lang) {
  var subject = lang === 'en'
    ? '[LP] New inquiry received'
    : '[LP] お問い合わせを受け付けました';

  var body = [
    lang === 'en' ? 'A new inquiry has been received from the LP.' : 'LPからお問い合わせがありました。',
    '',
    'Language: ' + lang,
    'Name: ' + data.name,
    'Phone: ' + data.phone,
    'Email: ' + data.email,
    'Residence: ' + (data.residence || '-'),
    'Contents:',
    data.contents || '-'
  ].join('\n');

  MailApp.sendEmail({
    to: 'abe@pled.co.jp',
    subject: subject,
    body: body,
    replyTo: data.email,
    name: 'ACTIS LP Form'
  });

  MailApp.sendEmail({
    to: 'customer@pled.co.jp',
    subject: subject,
    body: body,
    replyTo: data.email,
    name: 'ACTIS LP Form'
  });
}

function sendAutoReply_(data, lang) {
  var subject;
  var body;

  if (lang === 'en') {
    subject = 'Thank you for your inquiry';
    body = [
      data.name + ',',
      '',
      'Thank you for contacting ACTIS.',
      'We have received your inquiry and will get back to you shortly.',
      '',
      'Your inquiry details:',
      'Name: ' + data.name,
      'Phone: ' + data.phone,
      'Email: ' + data.email,
      'Current status of residence: ' + (data.residence || '-'),
      'Inquiry details: ' + (data.contents || '-'),
      '',
      'ACTIS Immigration Lawyer Corporation',
      '2-1-16 Otemon 4F, Chuo-ku, Fukuoka',
      'TEL: 092-753-9641'
    ].join('\n');
  } else {
    subject = 'お問い合わせありがとうございました。';
    body = [
      data.name + ' 様',
      '',
      'この度はお問い合わせいただきありがとうございます。',
      '内容を確認のうえ、担当者より折り返しご連絡いたします。',
      '',
      'お問い合わせ内容:',
      'お名前: ' + data.name,
      '電話番号: ' + data.phone,
      'メールアドレス: ' + data.email,
      '現在の在留資格: ' + (data.residence || '-'),
      'ご相談内容: ' + (data.contents || '-'),
      '',
      '行政書士法人アクティス',
      '福岡市中央区大手門2丁目1番16号4F',
      'TEL: 092-753-9641'
    ].join('\n');
  }

  MailApp.sendEmail({
    to: data.email,
    subject: subject,
    body: body,
    name: lang === 'en' ? 'ACTIS' : '行政書士法人アクティス'
  });
}

function resultHtml_(siteOrigin, payload) {
  var safeOrigin = escapeJs_(siteOrigin);
  var safePayload = escapeJs_(
    JSON.stringify(Object.assign({ type: 'actis-form-result' }, payload))
  );

  return HtmlService
    .createHtmlOutput(
      '<!doctype html><html><head><meta charset="utf-8"></head><body>' +
      '<script>' +
      'window.top.postMessage(JSON.parse("' + safePayload + '"), "' + safeOrigin + '");' +
      '</script>' +
      '</body></html>'
    )
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function escapeJs_(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
}
```

## GAS のデプロイ手順

GAS は Web アプリとしてデプロイします。

推奨設定:

- 実行ユーザー: `自分`
- アクセスできるユーザー: `全員`

GAS コードを変更したとき:

1. スクリプトを保存します。
2. 新しい権限が必要な場合は、手動実行用の関数を実行して権限を承認します。
3. Web アプリを新しいバージョンとしてデプロイします。
4. 新しい `/exec` URL をコピーします。
5. `public/jp/index.html` と `public/en/index.html` の `form action` を更新します。
6. URL 更新を commit / push します。

スプレッドシート権限でエラーが出る場合は、Apps Script 上で以下の関数を手動実行し、必要な権限を承認します。

```javascript
function authorizeSpreadsheetAccess_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log(spreadsheet.getName());
}
```

## Firebase のデプロイ

Pull Request では Firebase Hosting の preview deploy が実行されます。

- `.github/workflows/firebase-hosting-pull-request.yml`

`main` に merge されると、本番 Hosting へ deploy されます。

- `.github/workflows/firebase-hosting-merge.yml`

必要に応じて手動 deploy する場合:

```bash
firebase deploy --only hosting
```

## ローカル確認

`public` ディレクトリをローカル配信します。

```bash
python3 -m http.server 4173 --directory public
```

確認 URL:

- `http://localhost:4173/jp/`
- `http://localhost:4173/en/`

確認項目:

- ページが表示される
- 未入力送信が必須チェックで止まる
- プライバシーポリシー同意が必須になっている
- 正常送信で GAS に POST される
- GAS がシートへ 1 行追加する
- 管理者通知メールと自動返信メールが送信される
- サイト側のサンクスページへ遷移する

## 注意点

- `customer@pled.co.jp` が Google グループの場合、`abe@pled.co.jp` には届くが `customer@pled.co.jp` には届かないことがあります。その場合は Google グループ側の投稿権限とモデレーションキューを確認してください。
- `public/jp/thanks.html` と `public/en/thanks.html` には、固定の `web.app` URL 付近にコメントがあります。本番カスタムドメインが決まったら差し替えてください。
