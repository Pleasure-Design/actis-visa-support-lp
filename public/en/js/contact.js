(function() {
  var form = document.getElementById('mail_form');

  if (!form) {
    return;
  }

  var submitButton = document.getElementById('form_submit_button');
  var requiredMessage = form.dataset.requiredMessage || 'Please fill in the required fields.';
  var privacyMessage = form.dataset.privacyMessage || 'Please agree to the Privacy Policy.';
  var endpointMissingMessage = form.dataset.endpointMissingMessage || 'Set your GAS web app URL before publishing.';
  var placeholderUrl = 'https://script.google.com/macros/s/REPLACE_WITH_GAS_WEB_APP_URL/exec';

  form.addEventListener('submit', function(event) {
    var name = form.querySelector('[name="name_1"]');
    var phone = form.querySelector('[name="phone"]');
    var email = form.querySelector('[name="mail_address"]');
    var privacy = form.querySelector('[name="privacy"]');
    var returnUrl = form.querySelector('[name="return_url"]');

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

    if (returnUrl && returnUrl.value.charAt(0) === '/') {
      returnUrl.value = window.location.origin + returnUrl.value;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.value = 'Submitting...';
    }
  });
})();
