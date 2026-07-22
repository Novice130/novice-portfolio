'use client';

import { useState } from 'react';

/**
 * Schools contact form. Static export has no API routes, so until the
 * form endpoint (Resend + Turnstile worker) is deployed, submissions
 * fall back to a pre-filled email draft. Set FORM_ENDPOINT when ready.
 */
const FORM_ENDPOINT = ''; // e.g. 'https://forms.learnnovice.com/api/contact'
const CONTACT_EMAIL = 'syedamer@learnnovice.com';

const timezones = [
  'US Central',
  'US Eastern',
  'US Mountain',
  'US Pacific',
  'Other',
];

export default function SchoolsForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    if (!FORM_ENDPOINT) {
      const body = Object.entries(data)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
      window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
        `Findings call — ${data['school'] ?? ''}`
      )}&body=${encodeURIComponent(body)}`;
      setStatus('done');
      return;
    }

    setStatus('sending');
    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus('done');
      form.reset();
    } catch {
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <div className="card">
        <h3>Booked.</h3>
        <p style={{ marginBottom: 0 }}>
          You&rsquo;ll get a confirmation by email within a few minutes.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate={false}>
      <div className="field">
        <label htmlFor="f-school">
          School name <span className="req">(required)</span>
        </label>
        <input id="f-school" name="school" required autoComplete="organization" />
      </div>
      <div className="field">
        <label htmlFor="f-name">
          Contact name <span className="req">(required)</span>
        </label>
        <input id="f-name" name="name" required autoComplete="name" />
      </div>
      <div className="field">
        <label htmlFor="f-role">Role</label>
        <input id="f-role" name="role" placeholder="Principal, administrator, board member…" />
      </div>
      <div className="field">
        <label htmlFor="f-email">
          Email <span className="req">(required)</span>
        </label>
        <input id="f-email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="field">
        <label htmlFor="f-phone">Phone</label>
        <input id="f-phone" name="phone" type="tel" autoComplete="tel" />
      </div>
      <div className="grid-12" style={{ gap: 16 }}>
        <div className="field col-6">
          <label htmlFor="f-students">Student count</label>
          <input id="f-students" name="students" inputMode="numeric" />
        </div>
        <div className="field col-6">
          <label htmlFor="f-devices">Device count (approx.)</label>
          <input id="f-devices" name="devices" inputMode="numeric" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="f-prompt">What prompted you to get in touch?</label>
        <textarea id="f-prompt" name="prompted" />
      </div>
      <div className="grid-12" style={{ gap: 16 }}>
        <div className="field col-6">
          <label htmlFor="f-time">Best time to call</label>
          <input id="f-time" name="best_time" placeholder="e.g. weekday mornings" />
        </div>
        <div className="field col-6">
          <label htmlFor="f-tz">Timezone</label>
          <select id="f-tz" name="timezone" defaultValue="US Central">
            {timezones.map((tz) => (
              <option key={tz}>{tz}</option>
            ))}
          </select>
        </div>
      </div>

      {status === 'error' && (
        <p className="error-msg" role="alert">
          Something went wrong sending the form. Email us directly at{' '}
          {CONTACT_EMAIL}.
        </p>
      )}

      <button type="submit" className="btn btn--primary" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : 'Book the call'}
      </button>
    </form>
  );
}
