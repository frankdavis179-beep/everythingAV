const menuToggle = document.querySelector(".menu-toggle");
const primaryNav = document.querySelector(".primary-nav");

if (menuToggle && primaryNav) {
  menuToggle.addEventListener("click", () => {
    const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Open navigation" : "Close navigation");
    primaryNav.classList.toggle("is-open", !isOpen);
  });

  primaryNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Open navigation");
      primaryNav.classList.remove("is-open");
    });
  });
}

const year = document.querySelector("#year");
if (year) year.textContent = new Date().getFullYear();

const enquiryForm = document.querySelector("#enquiry-form");
const formNote = document.querySelector("#form-note");

if (enquiryForm && formNote) {
  const serviceOptions = enquiryForm.querySelector(".service-options");
  const serviceCheckboxes = enquiryForm.querySelectorAll('input[name="service"]');
  const submitButton = enquiryForm.querySelector('button[type="submit"]');
  const requestedServices = new URLSearchParams(window.location.search).getAll("service");

  serviceCheckboxes.forEach((checkbox) => {
    checkbox.checked = requestedServices.includes(checkbox.value);
  });

  serviceCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      if ([...serviceCheckboxes].some((option) => option.checked)) {
        serviceOptions?.classList.remove("needs-selection");
      }
    });
  });

  enquiryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (![...serviceCheckboxes].some((option) => option.checked)) {
      serviceOptions?.classList.add("needs-selection");
      formNote.textContent = "Please tick at least one service so we know what you’re looking for.";
      formNote.classList.add("is-active");
      serviceCheckboxes[0]?.focus();
      return;
    }

    serviceOptions?.classList.remove("needs-selection");
    formNote.classList.add("is-active");

    const originalButtonMarkup = submitButton?.innerHTML;
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.setAttribute("aria-busy", "true");
      submitButton.textContent = "Sending…";
    }
    formNote.textContent = "Sending your enquiry…";

    try {
      const formData = new FormData(enquiryForm);
      const response = await fetch("/api/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          services: formData.getAll("service"),
          message: formData.get("message"),
          website: formData.get("website"),
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.ok !== true) {
        throw new Error(result.error || "We couldn’t send your enquiry just now. Your message has not been sent; please try again later.");
      }

      formNote.classList.remove("is-error");
      formNote.textContent = "Thank you — your enquiry has been sent. We’ll be in touch soon.";
      enquiryForm.reset();
      serviceOptions?.classList.remove("needs-selection");
    } catch (error) {
      formNote.classList.add("is-error");
      formNote.textContent = error instanceof Error
        ? error.message
        : "We couldn’t send your enquiry just now. Your message has not been sent; please try again later.";
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.removeAttribute("aria-busy");
        if (originalButtonMarkup) submitButton.innerHTML = originalButtonMarkup;
      }
    }
  });
}
