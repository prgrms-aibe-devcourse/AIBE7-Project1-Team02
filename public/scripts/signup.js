document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("signupForm");
  const nicknameInput = document.getElementById("nickname");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const termsInput = document.getElementById("termsAccepted");
  const submitButton = document.getElementById("signupButton");
  const message = document.getElementById("authMessage");

  function showMessage(text, success = false) {
    message.textContent = text;
    message.hidden = false;
    message.classList.toggle("success", success);
  }

  function setSubmitting(submitting) {
    submitButton.disabled = submitting;
    submitButton.querySelector("span").textContent = submitting
      ? "계정 생성 중..."
      : "계정 만들기";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.hidden = true;

    if (!form.checkValidity() || !termsInput.checked) {
      form.reportValidity();
      return;
    }

    setSubmitting(true);

    try {
      await window.authService.signUp({
        nickname: nicknameInput.value.trim(),
        email: emailInput.value.trim(),
        password: passwordInput.value,
      });
      showMessage("계정이 생성되었습니다. 여행 MBTI 분석으로 이동합니다.", true);
      window.setTimeout(
        () => window.location.replace("./personality-test.html"),
        600,
      );
    } catch (error) {
      showMessage(error.message || "회원가입에 실패했습니다.");
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
