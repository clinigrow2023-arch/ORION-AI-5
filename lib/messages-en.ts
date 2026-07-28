/**
 * English message catalog.
 *
 * This object is the single source of truth for the translation key type:
 * every other catalog is typed against it, so a missing or misspelled key
 * fails at compile time. Placeholders use the `{{name}}` syntax.
 */
export const messagesEn = {
  common: {
    cancel: "Cancel",
    save: "Save",
    saving: "Saving...",
    loading: "Loading...",
    close: "Close",
    refresh: "Refresh",
    confirmAction: "Confirm action",
    characters: "{{count}} characters",
    active: "Active",
    blocked: "Blocked",
  },

  language: {
    label: "Language",
    trigger: "Change language",
    options: "Available languages",
  },

  app: {
    name: "Orion AI",
    loading: "Loading...",
    toggleMenu: "Toggle menu",
  },

  sidebar: {
    chat: "Mentor Chat",
    plan: "My Action Plan",
    guide: "Strategy Guide",
    support: "Support",
    admin: "Admin Dashboard",
    quote: "\"Emotions are the fuel, but strategy is the engine.\"",
    quoteAuthor: "— Orion Philosophy",
    changePassword: "Change Password",
    signOut: "Sign Out",
  },

  login: {
    subtitle: "Sign in to continue",
    email: "Email",
    emailPlaceholder: "your@email.com",
    password: "Password",
    passwordPlaceholder: "••••••••",
    submit: "Sign In",
    submitting: "Signing in...",
    errors: {
      emailRequired: "Email is required",
      emailInvalid: "Invalid email format",
      passwordRequired: "Password is required",
      passwordTooShort: "Password must be at least 6 characters",
      failed: "Login failed. Please try again.",
    },
  },

  register: {
    subtitle: "Create your account",
    name: "Name",
    namePlaceholder: "Your name",
    email: "Email",
    emailPlaceholder: "your@email.com",
    password: "Password",
    passwordPlaceholder: "••••••••",
    confirmPassword: "Confirm Password",
    submit: "Sign Up",
    submitting: "Creating account...",
    haveAccount: "Already have an account?",
    signIn: "Sign in",
    errors: {
      nameRequired: "Name is required",
      nameTooShort: "Name must be at least 2 characters",
      emailRequired: "Email is required",
      emailInvalid: "Invalid email format",
      passwordRequired: "Password is required",
      passwordTooShort: "Password must be at least 6 characters",
      confirmRequired: "Please confirm your password",
      passwordsMismatch: "Passwords do not match",
      failed: "Registration failed. Please try again.",
    },
  },

  setNewPassword: {
    title: "Set New Password",
    subtitle: "Your password has been reset. Please set a new password to continue.",
    newPassword: "New Password",
    newPasswordPlaceholder: "Enter new password",
    confirmPassword: "Confirm New Password",
    confirmPasswordPlaceholder: "Confirm new password",
    submit: "Set New Password",
    submitting: "Setting password...",
    successBadge: "Success!",
    success: "Password set successfully! Redirecting...",
    errors: {
      allFieldsRequired: "All fields are required",
      passwordTooShort: "Password must be at least 6 characters",
      passwordsMismatch: "Passwords do not match",
      failed: "Failed to set password",
    },
  },

  changePassword: {
    title: "Change Password",
    subtitle: "Update your account password",
    currentPassword: "Current Password",
    currentPasswordPlaceholder: "Enter current password",
    newPassword: "New Password",
    newPasswordPlaceholder: "Enter new password (min. 6 characters)",
    confirmPassword: "Confirm New Password",
    confirmPasswordPlaceholder: "Confirm new password",
    submit: "Change Password",
    submitting: "Changing...",
    success: "Password changed successfully!",
    errors: {
      allFieldsRequired: "All fields are required",
      passwordTooShort: "New password must be at least 6 characters",
      passwordsMismatch: "New passwords do not match",
      sameAsCurrent: "New password must be different from current password",
      failed: "Failed to change password",
    },
  },

  logoutModal: {
    title: "Sign Out",
    subtitle: "Confirm logout",
    message:
      "Are you sure you want to sign out? You will need to log in again to access your account.",
    confirm: "Sign Out",
  },

  authErrors: {
    serviceUnavailable:
      "Authentication service not available. Please make sure the development server is running (npm run dev) or deploy to production.",
    requestFailed: "Request failed ({{status}}). Please try again.",
    sessionExpired: "Your session has expired. Please sign in again.",
    accountBlocked:
      "Your account has been blocked. Please contact an administrator.",
  },

  chat: {
    header: {
      title: "Consultation Session",
      subtitle: "Provide details about your situation for analysis.",
    },
    conversations: {
      manage: "Manage conversations",
      title: "Conversations",
      item: "Chat {{date}}",
      create: "+ New Conversation",
      delete: "Delete conversation",
      reset: "Reset current chat",
    },
    welcome: {
      title: "Welcome to Orion AI",
      subtitle:
        "Tell me about your relationship status. Why did it end? What is your goal? I will analyze and guide you.",
    },
    input: {
      placeholder:
        "Describe the situation (e.g., 'She broke up with me yesterday because I was too needy...')",
      placeholderSignedOut: "Please log in to use the chat",
      send: "Send message",
    },
    analyzing: "Analyzing situation...",
    emptyMessage: {
      title: "Empty message (ID: {{id}})",
      hint: "This may indicate an issue with the AI response.",
    },
    alerts: {
      loginRequired: "Please log in to use the chat.",
      accountBlocked:
        "Your account has been blocked. Please contact an administrator.",
    },
    notices: {
      maxConversations:
        "⚠️ **Maximum Conversations Reached**\n\nYou have reached the maximum of 3 conversations. Please delete a conversation to create a new one.",
      accessNotGranted:
        "⚠️ **Access Not Granted**\n\nYour account access has not been granted or has expired. Please contact an administrator to grant access.",
      accountBlocked:
        "🚫 **Account Blocked**\n\nYour account has been blocked. Please contact an administrator.",
      genericError:
        "I encountered an error processing your strategy. Please try again.",
      apiKeyLeaked:
        "🔒 **Security Error Detected**\n\nYour API key has been reported as leaked by Google.\n\n**To resolve:**\n1. Visit [Google AI Studio](https://aistudio.google.com/apikey)\n2. Generate a new API key\n3. Update the `.env` file with the new key:\n   `GEMINI_API_KEY=your_new_key_here`\n4. Restart the server (`npm run dev`)",
      apiKeyMissing:
        "⚠️ **API Key Not Found**\n\nPlease add your Gemini API key to the `.env` file:\n`GEMINI_API_KEY=your_key_here`\n\nThen, restart the server.",
    },
    resetModal: {
      title: "Reset Chat",
      subtitle: "Start a new conversation",
      message:
        "Are you sure you want to reset the chat? This will clear all messages and start a fresh conversation. This action cannot be undone.",
      confirm: "Reset Chat",
    },
    deleteModal: {
      title: "Delete Conversation",
      subtitleWithDate: "Chat from {{date}}",
      subtitleGeneric: "This conversation",
      message:
        "Are you sure you want to delete this conversation? All messages will be permanently removed. This action cannot be undone.",
      confirm: "Delete Conversation",
    },
  },

  plan: {
    empty: {
      title: "Generate Your Strategy",
      description:
        "Orion will analyze your chat history to create a custom 3-step reconciliation plan, including specific texts and psychological triggers.",
      selectorLabel: "Select conversation to use as context:",
      selectorPlaceholder: "Select a conversation",
      conversationItem: "Chat from {{date}}",
      conversationMeta: "{{count}} messages • {{time}}",
      generate: "Generate Action Plan",
      generating: "Synthesizing Strategy...",
    },
    errors: {
      noAccess:
        "Your account access has not been granted or has expired. Please contact an administrator.",
      noContext:
        "Please select a conversation or chat with Orion first to provide context about your situation.",
      incomplete:
        "The generated plan is incomplete. Please try again or provide more details in the chat.",
      failed:
        "Failed to generate plan. Make sure you have provided enough details in the chat.",
    },
    sections: {
      diagnosis: "Diagnostic Analysis",
      steps: "3-Step Action Plan",
      messages: "Strategic Communication",
      dos: "Essential Actions",
      donts: "Critical Mistakes to Avoid",
      distancing: "Strategic Distancing",
      triggers: "Secret Signals",
    },
    discard: "Discard and regenerate plan",
  },

  guide: {
    title: "Core Strategic Philosophies",
    subtitle: "Master the psychological mechanics of reconciliation.",
    distancing: {
      title: "Strategic Distancing",
      subtitle: "The Power of Absence",
      intro:
        "Strategic distancing is not about \"playing hard to get.\" It is about resetting the power dynamic and allowing negative memories to fade.",
      fadingTitle: "The Fading Effect Bias:",
      fadingText:
        "Negative emotions fade faster than positive ones. By removing your presence, you stop reinforcing the negative anchor associated with the breakup.",
      scarcityTitle: "Scarcity Principle:",
      scarcityText:
        "Humans value what is scarce. Your availability reduces your perceived value.",
      curiosityTitle: "Curiosity Gap:",
      curiosityText:
        "When you disappear, they begin to wonder. \"Why isn't he chasing me?\" Curiosity is the first step back to attraction.",
    },
    triggers: {
      title: "Neurological Triggers",
      subtitle: "Activating Emotional Memory",
      intro:
        "Reconciliation isn't logical; it's emotional. You cannot convince someone to love you again using logic. You must trigger the feeling.",
      nostalgiaTitle: "The Nostalgia Spike",
      nostalgiaText:
        "Sending a casual, non-demanding message referencing a specific positive shared memory. This bypasses defense mechanisms and lights up the brain's reward center.",
      safetyTitle: "Safety Validation",
      safetyText:
        "Demonstrating that you have accepted the breakup. This removes the \"pressure\" they feel, making it safe for them to reach out without fear of being dragged back into drama.",
    },
    note: {
      before: "Ask Orion in the",
      link: "Mentor Chat",
      after:
        "for specific examples of how to apply these principles to your unique situation.",
    },
  },

  support: {
    title: "Contact Support",
    subtitle:
      "We're here to help! Click the button below to open your email client and send us a message.",
    sendTo: "Send us an email at:",
    openClient: "Open Email Client",
    note: "Clicking the button will open your default email client with a pre-filled message. We typically respond within 24-48 hours.",
    mailSubject: "Orion AI Support Request",
    mailBody: "Describe your problem",
  },

  waitingActivation: {
    expiredTitle: "Access Expired",
    waitingTitle: "Waiting for Activation",
    expiredText:
      "Your access has expired. Please contact an administrator to renew your access.",
    waitingText:
      "Your access has not been granted yet. Please contact an administrator to grant access to the chat.",
    registeredEmail: "Registered email:",
    check: "Check Activation",
    checking: "Checking...",
    signOut: "Sign Out",
    footer:
      "You will receive access once an administrator grants your account access.",
  },

  admin: {
    title: "Admin Dashboard",
    subtitle: "Manage users, blocks, and passwords",
    matches: "Matches:",
    totalUsers: "Total users:",
    pageInfo: "· page {{current}} of {{total}} ({{size}} per page)",
    tabs: {
      users: "Users",
      create: "Create User",
      prompt: "AI Prompt",
    },
    users: {
      loading: "Loading users...",
      searchPlaceholder: "Search by name or email...",
      clearSearchTitle: "Clear search",
      clearSearch: "Clear search",
      perPage: "Per page",
      prev: "Prev",
      next: "Next",
      pageStatus: "Page {{current}} of {{total}}",
      pageSummary: "This page: {{shown}} users · total matches: {{total}}",
      updatingList: "Updating list",
      columnUser: "User",
      columnEmail: "Email",
      columnRole: "Role",
      columnBlocked: "Blocked",
      columnActions: "Actions",
      block: "Block",
      unblock: "Unblock",
      role: "Role",
      resetPassword: "Reset PW",
      resetPasswordShort: "Reset",
      delete: "Delete",
      deleteShort: "Del",
      ownRoleTitle: "You cannot change your own role here",
      changeRoleTitle: "Change role (user / admin)",
      resetPasswordTitle:
        "Reset password - user will need to set new password on next login",
      ownAccountTitle: "You cannot delete your own account",
      deleteUserTitle: "Delete user account",
      emptySearch: "No users found matching your search",
      empty: "No users found",
    },
    create: {
      title: "Create User Manually",
      description:
        "Use this when a DigiStore payment was approved but email wasn't sent, or if there was an error. A random password will be generated and sent via email.",
      email: "Email",
      emailPlaceholder: "user@example.com",
      name: "Name",
      namePlaceholder: "User Name",
      role: "Role",
      language: "Language",
      languageHint:
        "Language used for this user's emails and AI answers until they change it.",
      submit: "Create User & Send Email",
      submitting: "Creating User...",
      noteLabel: "Note:",
      note: "A random password will be automatically generated and sent to the user's email. The user will be required to change this password on their first login.",
      success: "User {{email}} was created successfully.",
      successEmailSent: "A temporary password was sent by email.",
      successEmailFailed:
        "Email was not sent (configure GMAIL_USER/GMAIL_PASS on the server). You can use Reset PW to email a new temporary password once Gmail is configured.",
      errorRequired: "Email and name are required",
      errorInvalidEmail: "Invalid email format",
      errorFailed: "Failed to create user",
    },
    prompt: {
      title: "System Prompt Management",
      description:
        "Edit the system instruction all AI providers use. Changes apply globally to every AI answer in the selected language.",
      languageLabel: "Prompt language",
      languageHint:
        "Each language has its own prompt. Users always receive answers in their own language, even if this prompt is left empty.",
      currentTitle: "Current Active Prompt",
      version: "Version {{version}}",
      lastUpdated: "• Last updated: {{date}}",
      noPrompt: "No prompt saved yet",
      activeBadge: "✅ Active on all AI providers",
      inherited:
        "No prompt saved for this language yet. The English prompt is shown as a starting point and Orion still answers in {{language}}. Save it to create a dedicated version.",
      loading: "Loading prompt...",
      instructionLabel: "System Instruction",
      placeholder: "Enter the system instruction for all AI providers...",
      save: "Save Prompt",
      saving: "Saving...",
      saved:
        "✅ Prompt saved successfully! Version {{version}} is now active for {{language}} on all AI providers.",
      empty: "Prompt cannot be empty",
    },
    blockModal: {
      blockTitle: "Block User",
      unblockTitle: "Unblock User",
      blockMessage: "Are you sure you want to block {{name}}?",
      unblockMessage: "Are you sure you want to unblock {{name}}?",
      warning: "This will prevent the user from accessing the platform.",
      updating: "Updating...",
    },
    deleteModal: {
      title: "Delete User Account",
      message:
        "Are you sure you want to permanently delete the account for {{name}} ({{email}})?",
      warning:
        "⚠️ This action cannot be undone. All user data and conversations will be permanently deleted.",
      confirm: "Delete Account",
      deleting: "Deleting...",
    },
    roleModal: {
      title: "Change role",
      user: "User: {{name}}",
      label: "Role",
      confirm: "Save role",
    },
    resetPasswordModal: {
      title: "Reset Password",
      message: "Are you sure you want to reset the password for {{name}}?",
      warning:
        "The user will be required to set a new password on their next login attempt.",
      confirm: "Reset Password",
      resetting: "Resetting...",
    },
    errors: {
      accessDenied: "Access denied. Admin privileges required.",
      fetchUsers: "Failed to fetch users",
      loadUsers: "Failed to load users",
      updateUser: "Failed to update user",
      deleteUser: "Failed to delete user",
      resetPassword: "Failed to reset password",
      resetPasswordEmail:
        "Password was reset, but the email could not be sent. Configure GMAIL_USER and GMAIL_PASS on the server, or share access with the user manually.",
      loadPrompt: "Failed to load system prompt",
      savePrompt: "Failed to save system prompt",
    },
  },
};
