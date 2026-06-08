document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const rememberInput = document.getElementById("rememberMe");
  const submitButton = document.getElementById("loginButton");
  const message = document.getElementById("authMessage");

  function showMessage(text, success = false) {
    message.textContent = text;
    message.hidden = false;
    message.classList.toggle("success", success);
  }

  function setSubmitting(submitting) {
    submitButton.disabled = submitting;
    submitButton.querySelector("span").textContent = submitting
      ? "로그인 중..."
      : "로그인";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.hidden = true;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    setSubmitting(true);

    try {
      await window.authService.signIn({
        email: emailInput.value.trim(),
        password: passwordInput.value,
        remember: rememberInput.checked,
      });
      showMessage("로그인되었습니다. 메인 화면으로 이동합니다.", true);
      window.setTimeout(() => window.location.replace("../index.html"), 500);
    } catch (error) {
      showMessage(error.message || "로그인에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  });

  document.querySelector("[data-password-toggle]").addEventListener("click", (event) => {
    const button = event.currentTarget;
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    button.setAttribute("aria-label", isPassword ? "비밀번호 숨기기" : "비밀번호 표시");
  });

  if (window.lucide) {
    window.lucide.createIcons();
  }
});
