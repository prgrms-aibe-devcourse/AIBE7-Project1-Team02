(function initializePackingFeedback() {
  if (window.PackingUI) return;

  let activeResolver = null;
  let lastFocusedElement = null;

  function ensureDialog() {
    let overlay = document.getElementById("packing-feedback-overlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "packing-feedback-overlay";
    overlay.className = "packing-feedback-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <section
        class="packing-feedback-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="packing-feedback-title"
        aria-describedby="packing-feedback-message"
      >
        <div class="packing-feedback-icon" aria-hidden="true">
          <i data-lucide="info"></i>
        </div>
        <div class="packing-feedback-copy">
          <span class="packing-feedback-eyebrow">PACKING NOTICE</span>
          <h2 id="packing-feedback-title">안내</h2>
          <p id="packing-feedback-message"></p>
        </div>
        <div class="packing-feedback-actions">
          <button
            class="packing-feedback-cancel"
            id="packing-feedback-cancel"
            type="button"
          >
            취소
          </button>
          <button
            class="packing-feedback-confirm"
            id="packing-feedback-confirm"
            type="button"
          >
            확인
          </button>
        </div>
      </section>
    `;
    document.body.appendChild(overlay);

    overlay
      .querySelector("#packing-feedback-confirm")
      .addEventListener("click", () => closeDialog(true));
    overlay
      .querySelector("#packing-feedback-cancel")
      .addEventListener("click", () => closeDialog(false));
    overlay.addEventListener("click", (event) => {
      if (
        event.target === overlay &&
        overlay.dataset.dismissible === "true"
      ) {
        closeDialog(false);
      }
    });

    return overlay;
  }

  function closeDialog(result) {
    const overlay = document.getElementById("packing-feedback-overlay");
    if (!overlay?.classList.contains("active")) return;

    overlay.classList.remove("active");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("packing-feedback-open");
    const resolver = activeResolver;
    activeResolver = null;

    if (lastFocusedElement instanceof HTMLElement) {
      lastFocusedElement.focus();
    }
    lastFocusedElement = null;
    resolver?.(result);
  }

  function openDialog(message, options = {}) {
    if (activeResolver) {
      closeDialog(false);
    }

    const overlay = ensureDialog();
    const type = options.type || "info";
    const isConfirm = options.mode === "confirm";
    const confirmButton = overlay.querySelector("#packing-feedback-confirm");
    const cancelButton = overlay.querySelector("#packing-feedback-cancel");
    const title = overlay.querySelector("#packing-feedback-title");
    const messageElement = overlay.querySelector("#packing-feedback-message");
    const icon = overlay.querySelector(".packing-feedback-icon");
    const iconNames = {
      danger: "triangle-alert",
      error: "circle-alert",
      success: "circle-check",
      warning: "triangle-alert",
      info: "info",
    };

    overlay.dataset.type = type;
    overlay.dataset.dismissible = String(options.dismissible !== false);
    title.textContent =
      options.title ||
      (type === "success"
        ? "완료되었습니다"
        : type === "error"
          ? "처리하지 못했습니다"
          : type === "danger"
            ? "확인이 필요합니다"
            : "안내");
    messageElement.textContent = String(message || "");
    confirmButton.textContent = options.confirmText || "확인";
    cancelButton.textContent = options.cancelText || "취소";
    cancelButton.hidden = !isConfirm;
    confirmButton.classList.toggle(
      "packing-feedback-confirm-danger",
      type === "danger",
    );
    icon.innerHTML = `<i data-lucide="${iconNames[type] || "info"}"></i>`;

    lastFocusedElement = document.activeElement;
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("packing-feedback-open");
    window.lucide?.createIcons();

    return new Promise((resolve) => {
      activeResolver = resolve;
      confirmButton.focus();
    });
  }

  document.addEventListener("keydown", (event) => {
    const overlay = document.getElementById("packing-feedback-overlay");
    if (!overlay?.classList.contains("active")) return;

    if (event.key === "Escape" && overlay.dataset.dismissible === "true") {
      event.preventDefault();
      closeDialog(false);
    }
  });

  window.PackingUI = {
    alert(message, options = {}) {
      return openDialog(message, {
        ...options,
        mode: "alert",
      });
    },
    confirm(message, options = {}) {
      return openDialog(message, {
        ...options,
        mode: "confirm",
        dismissible: options.dismissible !== false,
      });
    },
  };
})();
