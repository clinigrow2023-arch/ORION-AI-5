import { DEFAULT_LOCALE, type Locale } from "./locale.js";

/**
 * Localized e-mail copy.
 *
 * Every transactional e-mail is described as a list of blocks instead of raw
 * HTML. The renderer in `email.ts` turns the same block list into the HTML and
 * the plain-text part, so a new language only needs translated copy - never a
 * second copy of the markup.
 */

export type EmailBlock =
  /** "Hello <strong>Name</strong>," - `{name}` is replaced by the renderer. */
  | { kind: "greeting"; template: string }
  | { kind: "paragraph"; text: string }
  /** Paragraph opened by a bold lead-in, e.g. "Important: ...". */
  | { kind: "notice"; label: string; text: string }
  /** Highlighted warning box (yellow) with a bold lead-in. */
  | { kind: "warning"; label: string; text: string }
  /** Boxed credentials list. */
  | { kind: "credentials"; title: string; items: EmailCredentialItem[] }
  /** Call-to-action button pointing at the login page. */
  | { kind: "button"; label: string };

export interface EmailCredentialItem {
  label: string;
  value: string;
}

export type EmailTheme = "brand" | "success" | "danger";

export interface EmailContent {
  subject: string;
  heading: string;
  theme: EmailTheme;
  blocks: EmailBlock[];
}

export interface EmailFooterCopy {
  automated: string;
  rights: string;
}

const FOOTER: Record<Locale, EmailFooterCopy> = {
  en: {
    automated: "This is an automated email, please do not reply.",
    rights: "Orion AI. All rights reserved.",
  },
  fr: {
    automated: "Ceci est un e-mail automatique, merci de ne pas y répondre.",
    rights: "Orion AI. Tous droits réservés.",
  },
};

export function emailFooter(locale: Locale): EmailFooterCopy {
  return FOOTER[locale] ?? FOOTER[DEFAULT_LOCALE];
}

/** Label of the plain-text line that carries the login URL. */
const ACCESS_LABEL: Record<Locale, string> = {
  en: "Access",
  fr: "Accès",
};

export function emailAccessLabel(locale: Locale): string {
  return ACCESS_LABEL[locale] ?? ACCESS_LABEL[DEFAULT_LOCALE];
}

type EmailBuilder<Args extends unknown[]> = Record<
  Locale,
  (...args: Args) => EmailContent
>;

export const newUserEmail: EmailBuilder<[name: string, email: string, password: string]> = {
  en: (name, email, password) => ({
    subject: "Welcome to Orion AI - Your Access Credentials",
    heading: "Welcome to Orion AI!",
    theme: "brand",
    blocks: [
      { kind: "greeting", template: "Hello {name}," },
      {
        kind: "paragraph",
        text: "Your purchase has been confirmed successfully! Your account has been created and is active.",
      },
      {
        kind: "credentials",
        title: "Your access credentials:",
        items: [
          { label: "Email:", value: email },
          { label: "Temporary password:", value: password },
        ],
      },
      {
        kind: "notice",
        label: "Important:",
        text: "For security reasons, you will need to change this password on your first login.",
      },
      { kind: "button", label: "Access Orion AI" },
      {
        kind: "paragraph",
        text: "If you have any questions or need help, please don't hesitate to contact us.",
      },
    ],
  }),
  fr: (name, email, password) => ({
    subject: "Bienvenue sur Orion AI - Vos identifiants d'accès",
    heading: "Bienvenue sur Orion AI !",
    theme: "brand",
    blocks: [
      { kind: "greeting", template: "Bonjour {name}," },
      {
        kind: "paragraph",
        text: "Votre achat a bien été confirmé ! Votre compte a été créé et il est actif.",
      },
      {
        kind: "credentials",
        title: "Vos identifiants d'accès :",
        items: [
          { label: "E-mail :", value: email },
          { label: "Mot de passe temporaire :", value: password },
        ],
      },
      {
        kind: "notice",
        label: "Important :",
        text: "Pour des raisons de sécurité, vous devrez modifier ce mot de passe lors de votre première connexion.",
      },
      { kind: "button", label: "Accéder à Orion AI" },
      {
        kind: "paragraph",
        text: "Si vous avez des questions ou besoin d'aide, n'hésitez pas à nous contacter.",
      },
    ],
  }),
};

export const existingUserEmail: EmailBuilder<[name: string]> = {
  en: () => ({
    subject: "Orion AI - Your Access Has Been Granted!",
    heading: "Your Access Has Been Granted!",
    theme: "brand",
    blocks: [
      { kind: "greeting", template: "Hello {name}," },
      {
        kind: "paragraph",
        text: "Great news! Your payment has been confirmed and your access to Orion AI has been granted.",
      },
      {
        kind: "paragraph",
        text: "You can now use all platform features with your existing account.",
      },
      { kind: "button", label: "Access Orion AI" },
      {
        kind: "paragraph",
        text: "Use your usual credentials to log in. If you forgot your password, you can reset it on the login page.",
      },
      {
        kind: "paragraph",
        text: "If you have any questions or need help, please don't hesitate to contact us.",
      },
    ],
  }),
  fr: () => ({
    subject: "Orion AI - Votre accès a été activé !",
    heading: "Votre accès a été activé !",
    theme: "brand",
    blocks: [
      { kind: "greeting", template: "Bonjour {name}," },
      {
        kind: "paragraph",
        text: "Bonne nouvelle ! Votre paiement a été confirmé et votre accès à Orion AI a été activé.",
      },
      {
        kind: "paragraph",
        text: "Vous pouvez dès maintenant utiliser toutes les fonctionnalités avec votre compte existant.",
      },
      { kind: "button", label: "Accéder à Orion AI" },
      {
        kind: "paragraph",
        text: "Connectez-vous avec vos identifiants habituels. Si vous avez oublié votre mot de passe, vous pouvez le réinitialiser sur la page de connexion.",
      },
      {
        kind: "paragraph",
        text: "Si vous avez des questions ou besoin d'aide, n'hésitez pas à nous contacter.",
      },
    ],
  }),
};

export const renewalThankYouEmail: EmailBuilder<[name: string]> = {
  en: () => ({
    subject: "Orion AI - Thanks for renewing your subscription!",
    heading: "Thank you for renewing!",
    theme: "success",
    blocks: [
      { kind: "greeting", template: "Hello {name}," },
      {
        kind: "paragraph",
        text: "We have successfully confirmed your renewal payment.",
      },
      {
        kind: "paragraph",
        text: "Your access to Orion AI remains active and available.",
      },
      { kind: "button", label: "Access Orion AI" },
      {
        kind: "paragraph",
        text: "Thank you for continuing with us. If you need anything, we're here to help.",
      },
    ],
  }),
  fr: () => ({
    subject: "Orion AI - Merci d'avoir renouvelé votre abonnement !",
    heading: "Merci pour votre renouvellement !",
    theme: "success",
    blocks: [
      { kind: "greeting", template: "Bonjour {name}," },
      {
        kind: "paragraph",
        text: "Nous avons bien confirmé le paiement de votre renouvellement.",
      },
      {
        kind: "paragraph",
        text: "Votre accès à Orion AI reste actif et disponible.",
      },
      { kind: "button", label: "Accéder à Orion AI" },
      {
        kind: "paragraph",
        text: "Merci de continuer avec nous. Si vous avez besoin de quoi que ce soit, nous sommes là pour vous aider.",
      },
    ],
  }),
};

export const subscriptionExpiredEmail: EmailBuilder<[name: string]> = {
  en: () => ({
    subject: "Orion AI - Your Subscription Has Expired",
    heading: "Your Subscription Has Expired",
    theme: "danger",
    blocks: [
      { kind: "greeting", template: "Hello {name}," },
      {
        kind: "warning",
        label: "Important:",
        text: "Your Orion AI subscription has expired.",
      },
      {
        kind: "paragraph",
        text: "Your access to Orion AI has been temporarily suspended because your subscription payment period has ended.",
      },
      {
        kind: "paragraph",
        text: "To continue using our services, please renew your subscription by making a new payment.",
      },
      { kind: "button", label: "Renew Subscription" },
      {
        kind: "paragraph",
        text: "Once your payment is confirmed, your access will be automatically restored and you'll be able to use all platform features again.",
      },
      {
        kind: "paragraph",
        text: "If you have any questions or need assistance, please don't hesitate to contact us.",
      },
    ],
  }),
  fr: () => ({
    subject: "Orion AI - Votre abonnement a expiré",
    heading: "Votre abonnement a expiré",
    theme: "danger",
    blocks: [
      { kind: "greeting", template: "Bonjour {name}," },
      {
        kind: "warning",
        label: "Important :",
        text: "Votre abonnement Orion AI a expiré.",
      },
      {
        kind: "paragraph",
        text: "Votre accès à Orion AI a été suspendu temporairement car la période de paiement de votre abonnement est terminée.",
      },
      {
        kind: "paragraph",
        text: "Pour continuer à utiliser nos services, veuillez renouveler votre abonnement en effectuant un nouveau paiement.",
      },
      { kind: "button", label: "Renouveler l'abonnement" },
      {
        kind: "paragraph",
        text: "Dès que votre paiement sera confirmé, votre accès sera rétabli automatiquement et vous pourrez utiliser à nouveau toutes les fonctionnalités.",
      },
      {
        kind: "paragraph",
        text: "Si vous avez des questions ou besoin d'aide, n'hésitez pas à nous contacter.",
      },
    ],
  }),
};

/** Escolhe o builder do idioma, caindo para inglês quando não houver tradução. */
export function pickEmail<Args extends unknown[]>(
  builder: EmailBuilder<Args>,
  locale: Locale,
  ...args: Args
): EmailContent {
  const build = builder[locale] ?? builder[DEFAULT_LOCALE];
  return build(...args);
}
