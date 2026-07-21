import { LegalLayout } from "./layout";

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" updated="July 21, 2026">
      <p>
        These Terms of Service ("Terms") govern access to and use of EduCore, a school management platform operated
        by EduCore Inc. ("EduCore", "we", "us"). By creating an account, signing up a school, or otherwise using
        EduCore, you agree to these Terms on behalf of yourself and, if applicable, the school you represent.
      </p>

      <h2>1. Who these Terms apply to</h2>
      <p>
        EduCore is provided to schools ("Customer") and, through the Customer, to the Customer's administrators,
        teachers, students, and parents/guardians ("Users"). The individual or school that signs up is responsible
        for ensuring every User at that school agrees to and complies with these Terms.
      </p>

      <h2>2. Accounts and access</h2>
      <p>
        A new school signup is reviewed and approved before it can be used. Once approved, the school's
        administrator is responsible for creating and managing accounts for teachers, students, and parents within
        that school, and for the accuracy of information entered. You are responsible for keeping login credentials
        confidential and for all activity under your account.
      </p>

      <h2>3. Subscriptions, trials, and billing</h2>
      <p>
        New schools receive a free trial period (its length is set by EduCore and shown in your dashboard). After
        the trial, continued access requires an active paid subscription. Subscription pricing is based on the
        school's enrolled student count, billed monthly or annually as selected, plus applicable taxes (GST).
        Payments are processed by Razorpay; EduCore does not store your card or bank details. EduCore may generate
        and send payment requests for a billing period, or a school may set up automatic recurring payment. Access
        may be suspended if a billing period lapses without payment, and restored once payment is received. See our
        <a href="/refund-policy"> Refund &amp; Cancellation Policy</a> for details on refunds and cancellations.
      </p>

      <h2>4. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use EduCore to store or share content that is unlawful, defamatory, or infringes another's rights;</li>
        <li>Attempt to access another school's data, or any account you are not authorized to access;</li>
        <li>Interfere with, probe, or disrupt the security or availability of the platform;</li>
        <li>Reverse-engineer or resell the platform without our written consent.</li>
      </ul>

      <h2>5. Data entered by schools</h2>
      <p>
        Schools use EduCore to record information about their own students, teachers, and parents, including
        academic records and, in some cases, information relating to minors. As between EduCore and the school, the
        school is responsible for having a lawful basis (including any required parental or guardian consent) to
        collect and enter that information into EduCore. EduCore processes this information on the school's behalf
        as described in our <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>6. Suspension and termination</h2>
      <p>
        We may suspend or terminate access for a school that violates these Terms, does not pay amounts due, or
        whose use poses a security or legal risk to EduCore or other schools. A school may stop using EduCore at
        any time; this does not entitle it to a refund of amounts already paid, except as described in our Refund
        &amp; Cancellation Policy.
      </p>

      <h2>7. Availability and changes</h2>
      <p>
        We aim to keep EduCore available at all times but do not guarantee uninterrupted service. We may update
        these Terms from time to time; continued use after an update means you accept the revised Terms.
      </p>

      <h2>8. Disclaimer and limitation of liability</h2>
      <p>
        EduCore is provided "as is" without warranties of any kind, to the maximum extent permitted by law. To the
        maximum extent permitted by law, EduCore is not liable for indirect, incidental, or consequential damages
        arising from use of the platform.
      </p>

      <h2>9. Governing law</h2>
      <p>These Terms are governed by the laws of India, without regard to conflict-of-law principles.</p>

      <h2>10. Contact</h2>
      <p>Questions about these Terms can be sent to support@thinknbuild.in.</p>
    </LegalLayout>
  );
}
