(function() {
  var form = document.getElementById('mail_form');

  if (!form) {
    return;
  }

  var submitButton = document.getElementById('form_submit_button');
  var siteOrigin = form.querySelector('[name="site_origin"]');
  var iframeName = 'mail_form_result';
  var requiredMessage = form.dataset.requiredMessage || 'Please fill in the required fields.';
  var privacyMessage = form.dataset.privacyMessage || 'Please agree to the Privacy Policy.';
  var endpointMissingMessage = form.dataset.endpointMissingMessage || 'Set your GAS web app URL before publishing.';
  var submitErrorMessage = form.dataset.submitErrorMessage || 'Submission failed. Please try again later.';
  var thanksPath = form.dataset.thanksPath || '/en/thanks.html';
  var placeholderUrl = 'https://script.google.com/macros/s/REPLACE_WITH_GAS_WEB_APP_URL/exec';
  var isSubmitting = false;
  var resultFrame = document.getElementById(iframeName);

  if (!resultFrame) {
    resultFrame = document.createElement('iframe');
    resultFrame.name = iframeName;
    resultFrame.id = iframeName;
    resultFrame.title = 'mail form result';
    resultFrame.style.display = 'none';
    form.parentNode.appendChild(resultFrame);
  }

  form.setAttribute('target', iframeName);

  function resetSubmitButton() {
    isSubmitting = false;

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.value = 'Submit';
    }
  }

  window.addEventListener('message', function(event) {
    if (!/^https:\/\/script\.google\.com$/i.test(event.origin)) {
      return;
    }

    var data = event.data || {};

    if (data.type !== 'actis-form-result') {
      return;
    }

    if (data.status === 'success') {
      window.location.href = thanksPath;
      return;
    }

    resetSubmitButton();
    window.alert(data.message || submitErrorMessage);
  });

  form.addEventListener('submit', function(event) {
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
      event.preventDefault();
      return;
    }

    if (siteOrigin) {
      siteOrigin.value = window.location.origin;
    }

    form.setAttribute('target', iframeName);

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.value = 'Submitting...';
    }

    isSubmitting = true;
  });
})();
