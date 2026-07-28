import type { MessageCatalog } from "./i18n";

/**
 * French message catalog.
 *
 * Typed against the English catalog: any missing, extra or misspelled key
 * breaks the TypeScript build instead of silently falling back to English.
 */
export const messagesFr: MessageCatalog = {
  common: {
    cancel: "Annuler",
    save: "Enregistrer",
    saving: "Enregistrement...",
    loading: "Chargement...",
    close: "Fermer",
    refresh: "Actualiser",
    confirmAction: "Confirmer l'action",
    characters: "{{count}} caractères",
    active: "Actif",
    inactive: "Inactif",
    blocked: "Bloqué",
  },

  language: {
    label: "Langue",
    trigger: "Changer de langue",
    options: "Langues disponibles",
  },

  app: {
    name: "Orion AI",
    loading: "Chargement...",
    toggleMenu: "Ouvrir ou fermer le menu",
  },

  sidebar: {
    chat: "Chat avec le mentor",
    plan: "Mon plan d'action",
    planReady: "Prêt",
    guide: "Guide stratégique",
    support: "Assistance",
    admin: "Tableau de bord admin",
    quote:
      "« Les émotions sont le carburant, mais la stratégie est le moteur. »",
    quoteAuthor: "— Philosophie Orion",
    changePassword: "Changer le mot de passe",
    signOut: "Se déconnecter",
  },

  login: {
    subtitle: "Connectez-vous pour continuer",
    email: "E-mail",
    emailPlaceholder: "votre@email.com",
    password: "Mot de passe",
    passwordPlaceholder: "••••••••",
    submit: "Se connecter",
    submitting: "Connexion...",
    errors: {
      emailRequired: "L'e-mail est obligatoire",
      emailInvalid: "Format d'e-mail invalide",
      passwordRequired: "Le mot de passe est obligatoire",
      passwordTooShort: "Le mot de passe doit contenir au moins 6 caractères",
      failed: "Échec de la connexion. Veuillez réessayer.",
    },
  },

  register: {
    subtitle: "Créez votre compte",
    name: "Nom",
    namePlaceholder: "Votre nom",
    email: "E-mail",
    emailPlaceholder: "votre@email.com",
    password: "Mot de passe",
    passwordPlaceholder: "••••••••",
    confirmPassword: "Confirmer le mot de passe",
    submit: "S'inscrire",
    submitting: "Création du compte...",
    haveAccount: "Vous avez déjà un compte ?",
    signIn: "Se connecter",
    errors: {
      nameRequired: "Le nom est obligatoire",
      nameTooShort: "Le nom doit contenir au moins 2 caractères",
      emailRequired: "L'e-mail est obligatoire",
      emailInvalid: "Format d'e-mail invalide",
      passwordRequired: "Le mot de passe est obligatoire",
      passwordTooShort: "Le mot de passe doit contenir au moins 6 caractères",
      confirmRequired: "Veuillez confirmer votre mot de passe",
      passwordsMismatch: "Les mots de passe ne correspondent pas",
      failed: "Échec de l'inscription. Veuillez réessayer.",
    },
  },

  setNewPassword: {
    title: "Définir un nouveau mot de passe",
    subtitle:
      "Votre mot de passe a été réinitialisé. Veuillez définir un nouveau mot de passe pour continuer.",
    newPassword: "Nouveau mot de passe",
    newPasswordPlaceholder: "Saisissez le nouveau mot de passe",
    confirmPassword: "Confirmer le nouveau mot de passe",
    confirmPasswordPlaceholder: "Confirmez le nouveau mot de passe",
    submit: "Définir le mot de passe",
    submitting: "Enregistrement du mot de passe...",
    successBadge: "Réussi !",
    success: "Mot de passe défini avec succès ! Redirection...",
    errors: {
      allFieldsRequired: "Tous les champs sont obligatoires",
      passwordTooShort: "Le mot de passe doit contenir au moins 6 caractères",
      passwordsMismatch: "Les mots de passe ne correspondent pas",
      failed: "Impossible de définir le mot de passe",
    },
  },

  changePassword: {
    title: "Changer le mot de passe",
    subtitle: "Mettez à jour le mot de passe de votre compte",
    currentPassword: "Mot de passe actuel",
    currentPasswordPlaceholder: "Saisissez le mot de passe actuel",
    newPassword: "Nouveau mot de passe",
    newPasswordPlaceholder: "Nouveau mot de passe (6 caractères minimum)",
    confirmPassword: "Confirmer le nouveau mot de passe",
    confirmPasswordPlaceholder: "Confirmez le nouveau mot de passe",
    submit: "Changer le mot de passe",
    submitting: "Modification...",
    success: "Mot de passe modifié avec succès !",
    errors: {
      allFieldsRequired: "Tous les champs sont obligatoires",
      passwordTooShort:
        "Le nouveau mot de passe doit contenir au moins 6 caractères",
      passwordsMismatch: "Les nouveaux mots de passe ne correspondent pas",
      sameAsCurrent:
        "Le nouveau mot de passe doit être différent de l'actuel",
      failed: "Impossible de changer le mot de passe",
    },
  },

  logoutModal: {
    title: "Se déconnecter",
    subtitle: "Confirmer la déconnexion",
    message:
      "Voulez-vous vraiment vous déconnecter ? Vous devrez vous reconnecter pour accéder à votre compte.",
    confirm: "Se déconnecter",
  },

  authErrors: {
    serviceUnavailable:
      "Service d'authentification indisponible. Vérifiez que le serveur de développement est démarré (npm run dev) ou déployez en production.",
    requestFailed: "Échec de la requête ({{status}}). Veuillez réessayer.",
    sessionExpired: "Votre session a expiré. Veuillez vous reconnecter.",
    accountBlocked:
      "Votre compte a été bloqué. Veuillez contacter un administrateur.",
  },

  chat: {
    header: {
      title: "Séance de consultation",
      subtitle: "Décrivez votre situation en détail pour l'analyse.",
    },
    conversations: {
      manage: "Gérer les conversations",
      title: "Conversations",
      item: "Chat du {{date}}",
      empty: "Aucune conversation pour le moment",
      create: "+ Nouvelle conversation",
      delete: "Supprimer la conversation",
      reset: "Réinitialiser le chat actuel",
      untitled: "Conversation sans titre",
      thisConversation: "cette conversation",
      messageOne: "1 message",
      messageMany: "{{count}} messages",
      planSaved: "plan enregistré",
    },
    welcome: {
      title: "Bienvenue sur Orion AI",
      subtitle:
        "Parlez-moi de votre situation amoureuse. Pourquoi cela s'est-il terminé ? Quel est votre objectif ? Je vais analyser et vous guider.",
    },
    input: {
      placeholder:
        "Décrivez la situation (ex. : « Elle m'a quitté hier parce que j'étais trop insistant... »)",
      placeholderSignedOut: "Connectez-vous pour utiliser le chat",
      send: "Envoyer le message",
    },
    analyzing: "Analyse de la situation...",
    emptyMessage: {
      title: "Message vide (ID : {{id}})",
      hint: "Cela peut indiquer un problème avec la réponse de l'IA.",
    },
    alerts: {
      loginRequired: "Connectez-vous pour utiliser le chat.",
      accountBlocked:
        "Votre compte a été bloqué. Veuillez contacter un administrateur.",
    },
    notices: {
      maxConversations:
        "⚠️ **Nombre maximal de conversations atteint**\n\nVous avez atteint la limite de 3 conversations. Supprimez une conversation pour en créer une nouvelle.",
      accessNotGranted:
        "⚠️ **Accès non accordé**\n\nL'accès à votre compte n'a pas été accordé ou a expiré. Contactez un administrateur pour obtenir l'accès.",
      accountBlocked:
        "🚫 **Compte bloqué**\n\nVotre compte a été bloqué. Veuillez contacter un administrateur.",
      genericError:
        "Une erreur est survenue lors du traitement de votre stratégie. Veuillez réessayer.",
      emptyResponse:
        "⚠️ **Réponse vide**\n\nOrion n'a pas réussi à produire de réponse cette fois. Reformulez votre message et réessayez.",
      aiBusy:
        "⏳ **Orion est occupé**\n\nTrop de personnes discutent avec Orion en ce moment. Attendez quelques secondes puis renvoyez votre message.",
      aiUnavailable:
        "⚠️ **Orion est indisponible**\n\nLe service d'IA n'a pas répondu. Veuillez réessayer dans un instant.",
    },
    resetModal: {
      title: "Réinitialiser le chat",
      subtitle: "Démarrer une nouvelle conversation",
      message:
        "Voulez-vous vraiment réinitialiser le chat ? Tous les messages seront effacés et une nouvelle conversation démarrera. Cette action est irréversible.",
      confirm: "Réinitialiser le chat",
    },
    deleteModal: {
      title: "Supprimer la conversation",
      subtitleWithDate: "Chat du {{date}}",
      subtitleGeneric: "Cette conversation",
      message:
        "Voulez-vous vraiment supprimer cette conversation ? Tous les messages seront définitivement effacés. Cette action est irréversible.",
      confirm: "Supprimer la conversation",
    },
  },

  plan: {
    empty: {
      title: "Générez votre stratégie",
      description:
        "Orion analysera votre historique de conversation pour créer un plan de réconciliation personnalisé en 3 étapes, avec des messages précis et des déclencheurs psychologiques.",
      selectorLabel: "Choisissez la conversation à utiliser comme contexte :",
      selectorPlaceholder: "Sélectionnez une conversation",
      conversationItem: "Chat du {{date}}",
      conversationMeta: "{{count}} messages • {{time}}",
      generate: "Générer le plan d'action",
      generating: "Synthèse de la stratégie...",
      generatingBackground: "Génération en arrière-plan...",
    },
    header: {
      planFor: "Plan pour :",
    },
    actions: {
      otherChat: "Utiliser un autre chat",
      delete: "Supprimer le plan",
      regenerate: "Régénérer",
    },
    background: {
      generating:
        "Votre plan est en cours de génération en arrière-plan. Vous pouvez continuer à utiliser le chat — nous vous préviendrons dès qu'il sera prêt.",
      regenerating:
        "Votre plan est en cours de régénération en arrière-plan. Nous vous préviendrons dès que la nouvelle version sera prête.",
      alreadyRunning:
        "Un plan est déjà en cours de génération pour cette conversation. Veuillez attendre la fin du traitement.",
    },
    ready: {
      title: "Votre plan est prêt",
      hint: "Touchez pour ouvrir votre plan d'action.",
    },
    saved: {
      open: "Ouvrir le plan enregistré",
    },
    notification: {
      ready: "Votre plan d'action pour « {{title}} » est prêt.",
    },
    dismiss: "Ignorer",
    errors: {
      noAccess:
        "L'accès à votre compte n'a pas été accordé ou a expiré. Veuillez contacter un administrateur.",
      noContext:
        "Sélectionnez une conversation ou discutez d'abord avec Orion pour fournir le contexte de votre situation.",
      incomplete:
        "Le plan généré est incomplet. Réessayez ou donnez plus de détails dans le chat.",
      failed:
        "Impossible de générer le plan. Vérifiez que vous avez donné assez de détails dans le chat.",
      unknown: "Impossible de générer le plan. Veuillez réessayer.",
      deleteFailed: "Impossible de supprimer le plan. Veuillez réessayer.",
      malformedJson:
        "Orion a renvoyé une réponse invalide pendant la création de votre plan. Veuillez le générer à nouveau.",
      outOfMemory:
        "Le serveur d'IA a manqué de mémoire pendant la création de votre plan. Réessayez dans quelques minutes.",
      truncated:
        "La réponse a été coupée avant la fin du plan. Veuillez le générer à nouveau.",
      modelMissing:
        "Le modèle d'IA n'est pas disponible sur le serveur. Veuillez contacter un administrateur.",
    },
    sections: {
      diagnosis: "Analyse diagnostique",
      steps: "Plan d'action en 3 étapes",
      messages: "Communication stratégique",
      dos: "Actions essentielles",
      donts: "Erreurs critiques à éviter",
      distancing: "Distanciation stratégique",
      triggers: "Signaux secrets",
    },
    discard: "Abandonner et régénérer le plan",
    deleteModal: {
      title: "Supprimer le plan",
      subtitle: "Ce plan d'action",
      message:
        "Voulez-vous vraiment supprimer ce plan d'action ? Vous pourrez en générer un nouveau ensuite, mais cette version sera définitivement supprimée.",
      confirm: "Supprimer le plan",
    },
    regenerateModal: {
      title: "Régénérer le plan",
      subtitle: "Remplacer le plan actuel",
      message:
        "Orion créera un nouveau plan à partir de cette conversation et remplacera l'actuel. Cela peut prendre quelques minutes.",
      confirm: "Régénérer le plan",
    },
  },

  guide: {
    title: "Philosophies stratégiques essentielles",
    subtitle: "Maîtrisez les mécanismes psychologiques de la réconciliation.",
    distancing: {
      title: "Distanciation stratégique",
      subtitle: "Le pouvoir de l'absence",
      intro:
        "La distanciation stratégique ne consiste pas à « jouer l'indifférent ». Il s'agit de rééquilibrer le rapport de force et de laisser les souvenirs négatifs s'estomper.",
      fadingTitle: "Le biais d'estompage :",
      fadingText:
        "Les émotions négatives s'estompent plus vite que les positives. En retirant votre présence, vous cessez de renforcer l'ancrage négatif associé à la rupture.",
      scarcityTitle: "Le principe de rareté :",
      scarcityText:
        "L'être humain valorise ce qui est rare. Votre disponibilité constante réduit votre valeur perçue.",
      curiosityTitle: "Le vide de curiosité :",
      curiosityText:
        "Quand vous disparaissez, l'autre commence à s'interroger : « Pourquoi ne cherche-t-il plus à me joindre ? » La curiosité est le premier pas vers le retour de l'attraction.",
    },
    triggers: {
      title: "Déclencheurs neurologiques",
      subtitle: "Activer la mémoire émotionnelle",
      intro:
        "La réconciliation n'est pas logique, elle est émotionnelle. On ne convainc personne d'aimer à nouveau avec des arguments : il faut réveiller l'émotion.",
      nostalgiaTitle: "Le pic de nostalgie",
      nostalgiaText:
        "Envoyer un message léger, sans aucune demande, qui rappelle un souvenir positif précis partagé à deux. Cela contourne les mécanismes de défense et active le circuit de la récompense.",
      safetyTitle: "La validation rassurante",
      safetyText:
        "Montrer que vous avez accepté la rupture. Cela supprime la « pression » ressentie par l'autre et lui permet de reprendre contact sans craindre d'être ramené dans le conflit.",
    },
    note: {
      before: "Demandez à Orion dans le",
      link: "Chat avec le mentor",
      after:
        "des exemples concrets pour appliquer ces principes à votre situation.",
    },
  },

  support: {
    title: "Contacter l'assistance",
    subtitle:
      "Nous sommes là pour vous aider ! Cliquez sur le bouton ci-dessous pour ouvrir votre logiciel de messagerie et nous écrire.",
    sendTo: "Écrivez-nous à :",
    openClient: "Ouvrir la messagerie",
    note: "Le bouton ouvre votre messagerie par défaut avec un message prérempli. Nous répondons généralement sous 24 à 48 heures.",
    mailSubject: "Demande d'assistance Orion AI",
    mailBody: "Décrivez votre problème",
  },

  waitingActivation: {
    expiredTitle: "Accès expiré",
    waitingTitle: "En attente d'activation",
    expiredText:
      "Votre accès a expiré. Contactez un administrateur pour le renouveler.",
    waitingText:
      "Votre accès n'a pas encore été accordé. Contactez un administrateur pour obtenir l'accès au chat.",
    registeredEmail: "E-mail enregistré :",
    check: "Vérifier l'activation",
    checking: "Vérification...",
    signOut: "Se déconnecter",
    footer:
      "Vous recevrez l'accès dès qu'un administrateur l'aura accordé à votre compte.",
  },

  admin: {
    title: "Tableau de bord admin",
    subtitle: "Gérer les utilisateurs, les blocages et les mots de passe",
    matches: "Résultats",
    pageInfo: "· page {{current}} sur {{total}} ({{size}} par page)",
    tabs: {
      users: "Utilisateurs",
      create: "Créer un utilisateur",
      usage: "Usage de l'IA",
    },
    stats: {
      all: "Total d'utilisateurs",
      active: "Actifs (accès à l'app)",
      inactive: "Inactifs",
      blocked: "Bloqués",
    },
    users: {
      loading: "Chargement des utilisateurs...",
      searchPlaceholder: "Rechercher par nom ou e-mail...",
      clearSearchTitle: "Effacer la recherche",
      clearSearch: "Effacer la recherche",
      perPage: "Par page",
      prev: "Précédent",
      next: "Suivant",
      pageStatus: "Page {{current}} sur {{total}}",
      pageSummary:
        "Cette page : {{shown}} utilisateurs · total des résultats : {{total}}",
      updatingList: "Mise à jour de la liste",
      columnUser: "Utilisateur",
      columnEmail: "E-mail",
      columnRole: "Rôle",
      columnAccess: "Accès",
      columnActions: "Actions",
      block: "Bloquer",
      unblock: "Débloquer",
      role: "Rôle",
      resetPassword: "Réinit. MDP",
      resetPasswordShort: "Réinit.",
      delete: "Supprimer",
      deleteShort: "Suppr.",
      ownRoleTitle: "Vous ne pouvez pas modifier votre propre rôle ici",
      changeRoleTitle: "Changer le rôle (user / admin)",
      resetPasswordTitle:
        "Réinitialiser le mot de passe - l'utilisateur devra en définir un nouveau à sa prochaine connexion",
      ownAccountTitle: "Vous ne pouvez pas supprimer votre propre compte",
      deleteUserTitle: "Supprimer le compte de l'utilisateur",
      emptySearch: "Aucun utilisateur ne correspond à votre recherche",
      empty: "Aucun utilisateur trouvé",
    },
    create: {
      title: "Créer un utilisateur manuellement",
      description:
        "À utiliser lorsqu'un paiement DigiStore a été approuvé sans envoi d'e-mail, ou en cas d'erreur. Un mot de passe aléatoire sera généré et envoyé par e-mail.",
      email: "E-mail",
      emailPlaceholder: "utilisateur@exemple.com",
      name: "Nom",
      namePlaceholder: "Nom de l'utilisateur",
      role: "Rôle",
      language: "Langue",
      languageHint:
        "Langue utilisée pour les e-mails et les réponses de l'IA de cet utilisateur, jusqu'à ce qu'il la change.",
      submit: "Créer l'utilisateur et envoyer l'e-mail",
      submitting: "Création de l'utilisateur...",
      noteLabel: "Remarque :",
      note: "Un mot de passe aléatoire sera généré automatiquement et envoyé à l'e-mail de l'utilisateur. Celui-ci devra le changer lors de sa première connexion.",
      success: "L'utilisateur {{email}} a été créé avec succès.",
      successEmailSent: "Un mot de passe temporaire a été envoyé par e-mail.",
      successEmailFailed:
        "L'e-mail n'a pas été envoyé (configurez GMAIL_USER/GMAIL_PASS sur le serveur). Utilisez « Réinit. MDP » pour envoyer un nouveau mot de passe temporaire une fois Gmail configuré.",
      errorRequired: "L'e-mail et le nom sont obligatoires",
      errorInvalidEmail: "Format d'e-mail invalide",
      errorFailed: "Impossible de créer l'utilisateur",
    },
    usage: {
      title: "Usage de l'IA",
      description:
        "Utilisateurs uniques par fenêtre de {{minutes}} minutes — requêtes de chat et de plan.",
      rangeOption: "Dernières {{hours}} h",
      loading: "Chargement de l'usage...",
      peak: "Pic d'utilisateurs simultanés",
      peakAt: "à {{time}}",
      uniqueUsers: "Utilisateurs uniques ({{hours}} h)",
      chatRequests: "Requêtes de chat",
      planRequests: "Générations de plan",
      columnWindow: "Fenêtre horaire",
      columnUsers: "Utilisateurs (total)",
      columnChat: "Chat",
      columnPlan: "Plan",
      columnLoad: "Charge",
      requests: "({{count}} req.)",
      empty:
        "Aucun usage de l'IA enregistré sur cette période. Les événements sont enregistrés à chaque message de chat et génération de plan.",
      loadFailed: "Impossible de charger l'usage de l'IA",
    },
    blockModal: {
      blockTitle: "Bloquer l'utilisateur",
      unblockTitle: "Débloquer l'utilisateur",
      blockMessage: "Voulez-vous vraiment bloquer {{name}} ?",
      unblockMessage: "Voulez-vous vraiment débloquer {{name}} ?",
      warning: "L'utilisateur ne pourra plus accéder à la plateforme.",
      updating: "Mise à jour...",
    },
    deleteModal: {
      title: "Supprimer le compte utilisateur",
      message:
        "Voulez-vous vraiment supprimer définitivement le compte de {{name}} ({{email}}) ?",
      warning:
        "⚠️ Cette action est irréversible. Toutes les données et conversations de l'utilisateur seront définitivement supprimées.",
      confirm: "Supprimer le compte",
      deleting: "Suppression...",
    },
    roleModal: {
      title: "Changer le rôle",
      user: "Utilisateur : {{name}}",
      label: "Rôle",
      confirm: "Enregistrer le rôle",
    },
    resetPasswordModal: {
      title: "Réinitialiser le mot de passe",
      message:
        "Voulez-vous vraiment réinitialiser le mot de passe de {{name}} ?",
      warning:
        "L'utilisateur devra définir un nouveau mot de passe à sa prochaine connexion.",
      confirm: "Réinitialiser le mot de passe",
      resetting: "Réinitialisation...",
    },
    errors: {
      sessionMissing: "Votre session a expiré. Reconnectez-vous.",
      accessDenied: "Accès refusé. Privilèges administrateur requis.",
      fetchUsers: "Impossible de récupérer les utilisateurs",
      loadUsers: "Impossible de charger les utilisateurs",
      updateUser: "Impossible de mettre à jour l'utilisateur",
      deleteUser: "Impossible de supprimer l'utilisateur",
      resetPassword: "Impossible de réinitialiser le mot de passe",
      resetPasswordEmail:
        "Le mot de passe a été réinitialisé, mais l'e-mail n'a pas pu être envoyé. Configurez GMAIL_USER et GMAIL_PASS sur le serveur, ou transmettez les accès manuellement à l'utilisateur.",
    },
  },
};
