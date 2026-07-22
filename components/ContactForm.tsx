'use client';

import { useState } from 'react';

/**
 * General contact form with a routing select as the first field.
 * The form adapts to the selected route. Same endpoint strategy as
 * SchoolsForm — mailto fallback until the form worker is deployed.
 */
const FORM_ENDPOINT = ''; // e.g. 'https://forms.learnnovice.com/api/contact'
const CONTACT_EMAIL = 'syedamer@learnnovice.com';

type Route = 'school' | 'software' | 'other';

export default function ContactForm() {
  const [route, setRoute] = useState<Route>('school');
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
        `Contact — ${data['name'] ?? ''}`
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
        <h3>Sent.</h3>
        <p style={{ marginBottom: 0 }}>
          You&rsquo;ll hear back within one business day, US Central.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="c-route">What brings you here?</label>
        <select
          id="c-route"
          name="route"
          value={route}
          onChange={(e) => setRoute(e.target.value as Route)}
        >
          <option value="school">I&rsquo;m from a school</option>
          <option value="software">I need software built</option>
          <option value="other">Something else</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="c-name">
          Name <span className="req">(required)</span>
        </label>
        <input id="c-name" name="name" required autoComplete="name" />
      </div>
      <div className="field">
        <label htmlFor="c-email">
          Email <span className="req">(required)</span>
        </label>
        <input id="c-email" name="email" type="email" required autoComplete="email" />
      </div>

      {route === 'school' && (
        <>
          <div className="field">
            <label htmlFor="c-school">School name</label>
            <input id="c-school" name="school" autoComplete="organization" />
          </div>
          <div className="grid-12" style={{ gap: 16 }}>
            <div className="field col-6">
              <label htmlFor="c-students">Student count</label>
              <input id="c-students" name="students" inputMode="numeric" />
            </div>
            <div className="field col-6">
              <label htmlFor="c-devices">Device count (approx.)</label>
              <input id="c-devices" name="devices" inputMode="numeric" />
            </div>
          </div>
        </>
      )}

      {route === 'software' && (
        <div className="field">
          <label htmlFor="c-org">Company / organisation</label>
          <input id="c-org" name="organisation" autoComplete="organization" />
        </div>
      )}

      <div className="field">
        <label htmlFor="c-message">
          {route === 'school'
            ? 'What prompted you to get in touch?'
            : route === 'software'
              ? 'What do you need built?'
              : 'How can we help?'}
        </label>
        <textarea id="c-message" name="message" />
      </div>

      {status === 'error' && (
        <p className="error-msg" role="alert">
          Something went wrong sending the form. Email us directly at {CONTACT_EMAIL}.
        </p>
      )}

      <button type="submit" className="btn btn--primary" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : route === 'school' ? 'Book the call' : 'Send'}
      </button>
    </form>
  );
}
