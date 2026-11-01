// Sends a <form data-email-form> through EmailJS (loaded from its CDN as window.emailjs).
// The form carries its EmailJS ids in data attributes; `buildParams` turns the fields into template params.
type Params = { from_name: string; from_email: string; subject: string; message: string };
declare global {
  interface Window {
    emailjs?: { send: (service: string, template: string, params: Params, opts: { publicKey: string }) => Promise<unknown> };
  }
}

export function setupEmailForm(form: HTMLFormElement, buildParams: (data: FormData) => Params) {
  const status = form.querySelector<HTMLElement>(".form__status");
  const button = form.querySelector<HTMLButtonElement>("button[type=submit]");
  const { publicKey = "", serviceId = "", templateId = "", fallbackEmail = "" } = form.dataset;
  const say = (text: string, state: "ok" | "error" | "") => {
    if (!status) return;
    status.textContent = text;
    status.dataset.state = state;
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    if (String(data.get("company_website") || "")) {
      // Honeypot field filled in: almost certainly a bot. Pretend it worked.
      form.reset();
      say("Sent. Thank you!", "ok");
      return;
    }
    if (!publicKey || !serviceId || !templateId || !window.emailjs) {
      say(`The form isn't available right now. Email me at ${fallbackEmail} instead.`, "error");
      return;
    }
    const labelEl = button?.querySelector<HTMLElement>(".btn__label") ?? button;
    const label = labelEl?.textContent ?? "";
    if (button && labelEl) { button.disabled = true; labelEl.textContent = "Sending…"; }
    say("", "");
    try {
      await window.emailjs.send(serviceId, templateId, buildParams(data), { publicKey });
      form.reset();
      say("Sent. Thank you, I'll get back to you soon.", "ok");
    } catch {
      say(`Couldn't send the message. Try again, or email me at ${fallbackEmail}.`, "error");
    } finally {
      if (button && labelEl) { button.disabled = false; labelEl.textContent = label; }
    }
  });
}
