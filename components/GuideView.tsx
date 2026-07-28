import React from 'react';
import { Brain, Zap, Anchor, Lock } from 'lucide-react';
import { useTranslation } from '../contexts/I18nContext';

const GuideView: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <div className="text-center mb-10 px-1">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 leading-snug break-words">
            {t("guide.title")}
          </h2>
          <p className="text-slate-400 leading-snug break-words">
            {t("guide.subtitle")}
          </p>
        </div>

        {/* Distancing */}
        <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800">
          <div className="bg-indigo-900/20 p-6 border-b border-slate-800 flex items-start gap-4 min-w-0">
            <div className="p-3 bg-indigo-600 rounded-lg text-white shrink-0">
              <Anchor size={24} />
            </div>
            <div className="min-w-0">
              <h3 className="text-xl font-bold text-white leading-snug break-words">
                {t("guide.distancing.title")}
              </h3>
              <p className="text-indigo-300 text-sm leading-snug break-words">
                {t("guide.distancing.subtitle")}
              </p>
            </div>
          </div>
          <div className="p-6 space-y-4 text-slate-300 leading-relaxed break-words">
            <p>{t("guide.distancing.intro")}</p>
            <ul className="space-y-2 list-disc list-inside text-slate-400 pl-4">
              <li>
                <strong className="text-white">
                  {t("guide.distancing.fadingTitle")}
                </strong>{" "}
                {t("guide.distancing.fadingText")}
              </li>
              <li>
                <strong className="text-white">
                  {t("guide.distancing.scarcityTitle")}
                </strong>{" "}
                {t("guide.distancing.scarcityText")}
              </li>
              <li>
                <strong className="text-white">
                  {t("guide.distancing.curiosityTitle")}
                </strong>{" "}
                {t("guide.distancing.curiosityText")}
              </li>
            </ul>
          </div>
        </div>

        {/* Neuro Triggers */}
        <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800">
          <div className="bg-violet-900/20 p-6 border-b border-slate-800 flex items-start gap-4 min-w-0">
            <div className="p-3 bg-violet-600 rounded-lg text-white shrink-0">
              <Zap size={24} />
            </div>
            <div className="min-w-0">
              <h3 className="text-xl font-bold text-white leading-snug break-words">
                {t("guide.triggers.title")}
              </h3>
              <p className="text-violet-300 text-sm leading-snug break-words">
                {t("guide.triggers.subtitle")}
              </p>
            </div>
          </div>
          <div className="p-6 space-y-4 text-slate-300 leading-relaxed break-words">
            <p>{t("guide.triggers.intro")}</p>
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div className="bg-slate-800 p-4 rounded-xl min-w-0">
                <h4 className="text-white font-semibold mb-2 flex items-start gap-2 leading-snug break-words">
                  <Brain size={16} className="shrink-0 mt-0.5" />{" "}
                  {t("guide.triggers.nostalgiaTitle")}
                </h4>
                <p className="text-sm text-slate-400 break-words">
                  {t("guide.triggers.nostalgiaText")}
                </p>
              </div>
              <div className="bg-slate-800 p-4 rounded-xl min-w-0">
                <h4 className="text-white font-semibold mb-2 flex items-start gap-2 leading-snug break-words">
                  <Lock size={16} className="shrink-0 mt-0.5" />{" "}
                  {t("guide.triggers.safetyTitle")}
                </h4>
                <p className="text-sm text-slate-400 break-words">
                  {t("guide.triggers.safetyText")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Note */}
        <div className="p-6 border border-dashed border-slate-700 rounded-xl text-center">
          <p className="text-slate-400 text-sm leading-relaxed break-words">
            {t("guide.note.before")}{" "}
            <span className="text-indigo-400 font-semibold cursor-pointer">
              {t("guide.note.link")}
            </span>{" "}
            {t("guide.note.after")}
          </p>
        </div>

      </div>
    </div>
  );
};

export default GuideView;
