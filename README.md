# ACTIS Visa Support LP

This repository hosts the ACTIS visa support landing pages as static files on Firebase Hosting. Form processing is handled by Google Apps Script (GAS).

## Hosting Structure

- `public/` is the Firebase Hosting public directory.
- `public/index.html` redirects visitors to `/jp/`.
- `public/jp/` contains the Japanese LP.
- `public/en/` contains the English LP.
- `public/jp/thanks.html` and `public/en/thanks.html` are site-side thank-you pages.
- PHP files are not deployed. Firebase Hosting serves static assets only.

Firebase settings:

- Project: `actis-visa-support-lp`
- Hosting public directory: `public`
- Config files: `firebase.json`, `.firebaserc`

## Form Flow

The form is submitted to GAS from the site, but the visible thank-you page is owned by this site.

Current flow:

1. User submits the form on `/jp/` or `/en/`.
2. `public/jp/js/contact.js` or `public/en/js/contact.js` validates required fields.
3. The form posts to GAS through a hidden iframe.
4. GAS records the inquiry, sends emails, and returns a small HTML response.
5. The site waits for a GAS completion signal, then redirects to the local thank-you page.
6. If the GAS response loads but `postMessage` is not received, the site falls back to redirecting to the local thank-you page after the iframe load.

The thank-you pages and their "back to top" buttons must remain site-side. Do not use GAS HTML as the customer-facing success page.

## Files To Update When GAS URL Changes

Update the `form action` in both files:

- `public/jp/index.html`
- `public/en/index.html`

Search for:

```html
<form action="https://script.google.com/macros/s/.../exec"
```

The `action` URL should point to the latest GAS Web App `/exec` URL.

## Site-Side Form JavaScript

The JavaScript lives in:

- `public/jp/js/contact.js`
- `public/en/js/contact.js`

Responsibilities:

- Required-field validation
- Privacy-policy checkbox validation
- Hidden iframe setup
- Passing `site_origin` to GAS
- Waiting for GAS completion
- Redirecting to `/jp/thanks.html` or `/en/thanks.html`
- Fallback redirect if the iframe loads but no `postMessage` arrives

GAS completion messages are accepted from:

- `https://script.google.com`
- `https://script.googleusercontent.com`

## GAS Responsibilities

GAS should only handle backend work:

- Receive form fields
- Validate required fields
- Save inquiry data to the bound spreadsheet
- Send admin notification emails
- Send an auto-reply to the form submitter
- Return a small HTML response that calls `window.top.postMessage(...)`

GAS should not own the visible thank-you page.

## GAS Code

Use a spreadsheet-bound Apps Script so `SpreadsheetApp.getActiveSpreadsheet()` can access the sheet. If the script is standalone, use `SpreadsheetApp.openById(...)` instead.

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

## GAS Deployment Notes

Deploy GAS as a Web App.

Recommended settings:

- Execute as: `Me`
- Who has access: `Anyone`

After changing GAS code:

1. Save the script.
2. Run a manual authorization function if new permissions are required.
3. Deploy a new Web App version.
4. Copy the new `/exec` URL.
5. Update `public/jp/index.html` and `public/en/index.html`.
6. Commit and push the URL update.

If spreadsheet access fails with an authorization error, run a small manual function in Apps Script and approve the requested scopes:

```javascript
function authorizeSpreadsheetAccess_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log(spreadsheet.getName());
}
```

## Firebase Deployment

Pull requests trigger a Firebase Hosting preview through:

- `.github/workflows/firebase-hosting-pull-request.yml`

Merges to `main` deploy live Hosting through:

- `.github/workflows/firebase-hosting-merge.yml`

Manual deploy, if needed:

```bash
firebase deploy --only hosting
```

## Local Checks

Serve the `public` directory locally:

```bash
python3 -m http.server 4173 --directory public
```

Then open:

- `http://localhost:4173/jp/`
- `http://localhost:4173/en/`

Basic checks:

- Page renders.
- Required fields block empty submits.
- Privacy checkbox is required.
- Valid submit posts to GAS.
- GAS writes a row to the sheet.
- Admin and auto-reply emails are sent.
- The user lands on the site-side thank-you page.

## Notes

- `customer@pled.co.jp` may be a Google Group. If mail does not arrive there but arrives at `abe@pled.co.jp`, check the Google Group posting permissions and moderation queue.
- `public/jp/thanks.html` and `public/en/thanks.html` include comments near fixed `web.app` URLs. Replace those with the production custom domain when it is ready.
