(function() {
  var form = document.getElementById('mail_form');

  if (!form) {
    return;
  }

  var submitButton = document.getElementById('form_submit_button');
  var requiredMessage = form.dataset.requiredMessage || '必須項目を入力してください。';
  var privacyMessage = form.dataset.privacyMessage || 'プライバシーポリシーに同意してください。';
  var endpointMissingMessage = form.dataset.endpointMissingMessage || 'GASのWebアプリURLを設定してください。';
  var thanksPath = form.dataset.thanksPath || '/jp/thanks.html';
  var placeholderUrl = 'https://script.google.com/macros/s/REPLACE_WITH_GAS_WEB_APP_URL/exec';
  var isSubmitting = false;

  function resetSubmitButton() {
    isSubmitting = false;

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.value = '送信する';
    }
  }

  form.addEventListener('submit', function(event) {
    event.preventDefault();

    var name = form.querySelector('[name="name_1"]');
    var phone = form.querySelector('[name="phone"]');
    var email = form.querySelector('[name="mail_address"]');
    var privacy = form.querySelector('[name="privacy"]');

    if (form.action === placeholderUrl) {
      event.preventDefault();
      window.alert(endpointMissingMessage);
      return;
    }

    if (!name.value.trim() || !phone.value.trim() || !email.value.trim()) {
      event.preventDefault();
      window.alert(requiredMessage);
      return;
    }

    if (!privacy.checked) {
      event.preventDefault();
      window.alert(privacyMessage);
      return;
    }

    if (isSubmitting) {
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.value = '送信中...';
    }

    isSubmitting = true;

    var formData = new FormData(form);
    var submitted = false;

    if (navigator.sendBeacon) {
      try {
        submitted = navigator.sendBeacon(form.action, formData);
      } catch (error) {
        submitted = false;
      }
    }

    if (!submitted) {
      fetch(form.action, {
        method: 'POST',
        mode: 'no-cors',
        body: formData,
        keepalive: true
      }).catch(function() {});
    }

    window.location.href = thanksPath;

    setTimeout(resetSubmitButton, 2000);
  });
})();
