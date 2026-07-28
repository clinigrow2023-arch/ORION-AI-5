import { DEFAULT_LOCALE, type Locale } from "./locale.js";

/**
 * User-facing API messages.
 *
 * Handlers return these strings directly to the client, so they must be
 * localized. Internal/technical details stay in English on purpose (logs and
 * `details` fields are for developers, not end users).
 */
const apiMessagesEn = {
  authRequired: "Authentication required",
  invalidToken: "Invalid token",
  noToken: "No token provided",
  invalidOrExpiredToken: "Invalid or expired token",
  unauthorized: "Unauthorized",
  accessDenied: "Access denied",
  adminRequired: "Admin access required",
  methodNotAllowed: "Method not allowed",
  endpointNotFound: "Endpoint not found",
  internalError: "Internal server error",
  databaseConfigError: "Database configuration error",
  databaseClientError: "Database client error",
  databaseConnectionError: "Database connection error",

  emailAndPasswordRequired: "Email and password are required",
  invalidCredentials: "Invalid email or password",
  accountBlocked: "Account is blocked",
  accountNotActive: "Account is not active",
  subscriptionExpired:
    "Your subscription has expired. Please renew your subscription to continue using the service.",
  registrationFieldsRequired: "Name, email and password are required",
  nameTooShort: "Name must be at least 2 characters",
  invalidEmailFormat: "Invalid email format",
  passwordTooShort: "Password must be at least 6 characters",
  newPasswordTooShort: "New password must be at least 6 characters",
  emailAlreadyRegistered: "Email already registered",
  emailAlreadyExists: "Email already exists",
  userCreated: "User created successfully",
  userNotFound: "User not found",
  currentAndNewPasswordRequired:
    "Current password and new password are required",
  currentPasswordIncorrect: "Current password is incorrect",
  passwordChanged: "Password changed successfully",
  newPasswordAndConfirmationRequired:
    "New password and confirmation are required",
  passwordsDoNotMatch: "Passwords do not match",
  passwordResetNotRequired: "Password reset is not required for this account",
  passwordSet: "Password set successfully",
  passwordResetDone: "Password reset successfully",
  userUpdated: "User updated successfully",
  userDeleted: "User deleted successfully",
  nameAndEmailRequired: "Name and email are required",
  userIdRequired: "User ID is required",
  noValidUpdates: "No valid updates provided",
  cannotChangeOwnRole: "Cannot change your own admin role",
  cannotDeleteOwnAccount: "Cannot delete your own account",
  localeRequired: "A supported language is required",
  localeUpdated: "Language updated successfully",

  messageRequired: "Message is required",
  messagesArrayRequired: "Messages array is required",
  conversationPayloadRequired: "conversationId and messages array are required",
  conversationIdRequired: "conversationId is required",
  conversationNotFound: "Conversation not found",
  maxConversations:
    "Maximum of 3 conversations allowed. Please delete a conversation to create a new one.",

  promptRequired: "Prompt is required",
  promptUpdated: "System prompt updated successfully",
  promptSaveFailed: "Failed to save prompt",
};

export type ApiMessageKey = keyof typeof apiMessagesEn;

const apiMessagesFr: Record<ApiMessageKey, string> = {
  authRequired: "Authentification requise",
  invalidToken: "Jeton invalide",
  noToken: "Aucun jeton fourni",
  invalidOrExpiredToken: "Jeton invalide ou expiré",
  unauthorized: "Non autorisé",
  accessDenied: "Accès refusé",
  adminRequired: "Accès administrateur requis",
  methodNotAllowed: "Méthode non autorisée",
  endpointNotFound: "Point de terminaison introuvable",
  internalError: "Erreur interne du serveur",
  databaseConfigError: "Erreur de configuration de la base de données",
  databaseClientError: "Erreur du client de base de données",
  databaseConnectionError: "Erreur de connexion à la base de données",

  emailAndPasswordRequired: "L'e-mail et le mot de passe sont obligatoires",
  invalidCredentials: "E-mail ou mot de passe incorrect",
  accountBlocked: "Le compte est bloqué",
  accountNotActive: "Le compte n'est pas actif",
  subscriptionExpired:
    "Votre abonnement a expiré. Veuillez le renouveler pour continuer à utiliser le service.",
  registrationFieldsRequired:
    "Le nom, l'e-mail et le mot de passe sont obligatoires",
  nameTooShort: "Le nom doit contenir au moins 2 caractères",
  invalidEmailFormat: "Format d'e-mail invalide",
  passwordTooShort: "Le mot de passe doit contenir au moins 6 caractères",
  newPasswordTooShort:
    "Le nouveau mot de passe doit contenir au moins 6 caractères",
  emailAlreadyRegistered: "Cet e-mail est déjà enregistré",
  emailAlreadyExists: "Cet e-mail existe déjà",
  userCreated: "Utilisateur créé avec succès",
  userNotFound: "Utilisateur introuvable",
  currentAndNewPasswordRequired:
    "Le mot de passe actuel et le nouveau mot de passe sont obligatoires",
  currentPasswordIncorrect: "Le mot de passe actuel est incorrect",
  passwordChanged: "Mot de passe modifié avec succès",
  newPasswordAndConfirmationRequired:
    "Le nouveau mot de passe et sa confirmation sont obligatoires",
  passwordsDoNotMatch: "Les mots de passe ne correspondent pas",
  passwordResetNotRequired:
    "La réinitialisation du mot de passe n'est pas requise pour ce compte",
  passwordSet: "Mot de passe défini avec succès",
  passwordResetDone: "Mot de passe réinitialisé avec succès",
  userUpdated: "Utilisateur mis à jour avec succès",
  userDeleted: "Utilisateur supprimé avec succès",
  nameAndEmailRequired: "Le nom et l'e-mail sont obligatoires",
  userIdRequired: "L'identifiant de l'utilisateur est obligatoire",
  noValidUpdates: "Aucune mise à jour valide fournie",
  cannotChangeOwnRole:
    "Vous ne pouvez pas modifier votre propre rôle administrateur",
  cannotDeleteOwnAccount: "Vous ne pouvez pas supprimer votre propre compte",
  localeRequired: "Une langue prise en charge est obligatoire",
  localeUpdated: "Langue mise à jour avec succès",

  messageRequired: "Le message est obligatoire",
  messagesArrayRequired: "Un tableau de messages est obligatoire",
  conversationPayloadRequired:
    "conversationId et le tableau de messages sont obligatoires",
  conversationIdRequired: "conversationId est obligatoire",
  conversationNotFound: "Conversation introuvable",
  maxConversations:
    "Maximum de 3 conversations autorisées. Supprimez une conversation pour en créer une nouvelle.",

  promptRequired: "Le prompt est obligatoire",
  promptUpdated: "Prompt système mis à jour avec succès",
  promptSaveFailed: "Impossible d'enregistrer le prompt",
};

const API_MESSAGES: Record<Locale, Record<ApiMessageKey, string>> = {
  en: apiMessagesEn,
  fr: apiMessagesFr,
};

export function apiMessage(locale: Locale, key: ApiMessageKey): string {
  return API_MESSAGES[locale]?.[key] ?? API_MESSAGES[DEFAULT_LOCALE][key];
}
