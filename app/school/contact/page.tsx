import type { Metadata } from 'next';
import Section from '@/components/Section';
import ContactForm from '@/components/ContactForm';
import CalEmbed from '@/components/CalEmbed';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Start with a conversation, not a contract. Schools, software, or something else — we respond within one business day.',
};

export default function Contact() {
  return (
    <Section rail="01 / CONTACT">
      <h1>
        Talk to <em>us.</em>
      </h1>
      <p className="lead" style={{ marginTop: 24 }}>
        We respond within one business day, US Central.
      </p>
      <div className="grid-12" style={{ marginTop: 48 }}>
        <div className="col-6">
          <ContactForm />
        </div>
        <div className="col-6">
          <CalEmbed />
        </div>
      </div>
    </Section>
  );
}
