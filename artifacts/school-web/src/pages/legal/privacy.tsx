import { LegalLayout } from "./layout";

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="July 21, 2026">
      <p>
        This Privacy Policy explains what information EduCore Inc. ("EduCore", "we") collects through the EduCore
        school management platform, how it is used, and the choices available to schools and Users.
      </p>

      <h2>1. Our role: EduCore acts on the school's behalf</h2>
      <p>
        A school that signs up for EduCore ("Customer") is the data controller for the student, parent, and staff
        information it enters into the platform — the school decides what information to collect and why. EduCore
        acts as a data processor / service provider, storing and processing that information only to provide the
        platform and only as instructed by the school. If you are a student, parent, or teacher, your school's own
        policies govern what information about you is entered into EduCore; questions about that data should go to
        your school first.
      </p>

      <h2>2. Information we collect</h2>
      <p>We collect the following categories of information:</p>
      <ul>
        <li>
          <strong>Account information:</strong> name, email address, phone number, role, and profile photo for
          admins, teachers, students, and parents.
        </li>
        <li>
          <strong>Academic and school records:</strong> class/section, roll number, attendance, marks and exam
          records, fee and payment status, notices, and — where entered by the school — date of birth and
          guardian/parent contact details.
        </li>
        <li>
          <strong>School billing information:</strong> student counts used to determine subscription pricing,
          billing history, and subscription status. Card, UPI, and bank details are collected and processed
          directly by Razorpay, our payment processor — EduCore does not receive or store them.
        </li>
        <li>
          <strong>Technical information:</strong> log data such as IP address and timestamps, used for security and
          troubleshooting.
        </li>
      </ul>

      <h2>3. Children's information</h2>
      <p>
        EduCore is used by schools to manage records that include information about students who may be minors.
        This information is entered and controlled by the school, not collected by EduCore directly from children.
        Schools are responsible for obtaining any parental or guardian consent required under applicable law before
        entering a minor's information into EduCore.
      </p>

      <h2>4. How we use information</h2>
      <ul>
        <li>To operate the platform: authentication, dashboards, attendance, marks, fees, and notices;</li>
        <li>To compute subscription pricing and process billing through Razorpay;</li>
        <li>To send account, billing, and notice emails (for example, via our email provider, Resend);</li>
        <li>To maintain security, prevent abuse, and enforce our Terms of Service;</li>
        <li>To comply with legal obligations.</li>
      </ul>
      <p>We do not sell student, parent, or teacher information, and we do not use it for advertising.</p>

      <h2>5. Sharing</h2>
      <p>We share information only with:</p>
      <ul>
        <li>The school that entered it, and Users the school has authorized to see it (e.g. a parent's own child's records);</li>
        <li>Service providers who process data on our behalf, currently Razorpay (payments) and Resend (email delivery), and our hosting/database providers;</li>
        <li>Authorities, where required by law.</li>
      </ul>

      <h2>6. Data retention</h2>
      <p>
        We retain school data for as long as the school's account is active, and for a reasonable period after
        cancellation in case the school wishes to reactivate or export records, after which it is deleted or
        anonymized, unless a longer period is required by law.
      </p>

      <h2>7. Security</h2>
      <p>
        We use industry-standard measures — including encrypted connections, hashed passwords, and access controls
        scoped per school — to protect information. No system is completely secure, and we encourage schools to use
        strong, unique passwords for admin accounts.
      </p>

      <h2>8. Your choices</h2>
      <p>
        A school administrator can update or remove student, teacher, and parent records within the platform, or
        request help doing so. A school can disable email notifications from its settings. Individual Users should
        contact their school administrator to correct or remove personal information.
      </p>

      <h2>9. Changes to this policy</h2>
      <p>We may update this Privacy Policy from time to time; the "Last updated" date above will reflect the latest revision.</p>

      <h2>10. Contact</h2>
      <p>Questions about this Privacy Policy can be sent to thinknbuild.in@gmail.com.</p>
    </LegalLayout>
  );
}
