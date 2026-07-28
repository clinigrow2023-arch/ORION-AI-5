import React from "react";
import { Mail } from "lucide-react";
import { useTranslation } from "../contexts/I18nContext";

const SupportView: React.FC = () => {
  const { t } = useTranslation();
  const supportEmail =
    import.meta.env.VITE_SUPPORT_EMAIL || "gmrelationship@gmail.com";

  const handleContactSupport = () => {
    const subject = encodeURIComponent(t("support.mailSubject"));
    const body = encodeURIComponent(t("support.mailBody"));

    window.open(
      `mailto:${supportEmail}?subject=${subject}&body=${body}`,
      "_blank"
    );
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8 px-1">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-full mb-4">
            <Mail className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 leading-snug break-words">
            {t("support.title")}
          </h2>
          <p className="text-slate-400 leading-snug break-words">
            {t("support.subtitle")}
          </p>
        </div>

        <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 p-6 sm:p-8">
          <div className="text-center space-y-6">
            <div className="space-y-2 min-w-0">
              <p className="text-slate-300 text-lg leading-snug break-words">
                {t("support.sendTo")}
              </p>
              <a
                href={`mailto:${supportEmail}`}
                className="text-indigo-400 hover:text-indigo-300 text-lg sm:text-xl font-medium transition-colors break-all"
              >
                {supportEmail}
              </a>
            </div>

            <button
              onClick={handleContactSupport}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all leading-snug whitespace-normal"
            >
              <Mail className="w-5 h-5 shrink-0" />
              <span className="min-w-0 break-words">{t("support.openClient")}</span>
            </button>
          </div>
        </div>

        <div className="mt-8 p-4 bg-slate-900/50 border border-slate-800 rounded-lg">
          <p className="text-xs text-slate-400 text-center leading-relaxed break-words">
            {t("support.note")}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SupportView;
