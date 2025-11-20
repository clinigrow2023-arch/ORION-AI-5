import React from 'react';
import { Brain, Zap, Anchor, Lock } from 'lucide-react';

const GuideView: React.FC = () => {
  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-white mb-2">Core Strategic Philosophies</h2>
          <p className="text-slate-400">Master the psychological mechanics of reconciliation.</p>
        </div>

        {/* Distancing */}
        <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800">
          <div className="bg-indigo-900/20 p-6 border-b border-slate-800 flex items-center gap-4">
            <div className="p-3 bg-indigo-600 rounded-lg text-white">
              <Anchor size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Strategic Distancing</h3>
              <p className="text-indigo-300 text-sm">The Power of Absence</p>
            </div>
          </div>
          <div className="p-6 space-y-4 text-slate-300 leading-relaxed">
            <p>
              Strategic distancing is not about "playing hard to get." It is about resetting the power dynamic and allowing negative memories to fade.
            </p>
            <ul className="space-y-2 list-disc list-inside text-slate-400 pl-4">
              <li><strong className="text-white">The Fading Effect Bias:</strong> Negative emotions fade faster than positive ones. By removing your presence, you stop reinforcing the negative anchor associated with the breakup.</li>
              <li><strong className="text-white">Scarcity Principle:</strong> Humans value what is scarce. Your availability reduces your perceived value.</li>
              <li><strong className="text-white">Curiosity Gap:</strong> When you disappear, they begin to wonder. "Why isn't he chasing me?" Curiosity is the first step back to attraction.</li>
            </ul>
          </div>
        </div>

        {/* Neuro Triggers */}
        <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-800">
          <div className="bg-violet-900/20 p-6 border-b border-slate-800 flex items-center gap-4">
            <div className="p-3 bg-violet-600 rounded-lg text-white">
              <Zap size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Neurological Triggers</h3>
              <p className="text-violet-300 text-sm">Activating Emotional Memory</p>
            </div>
          </div>
          <div className="p-6 space-y-4 text-slate-300 leading-relaxed">
            <p>
              Reconciliation isn't logical; it's emotional. You cannot convince someone to love you again using logic. You must trigger the feeling.
            </p>
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div className="bg-slate-800 p-4 rounded-xl">
                <h4 className="text-white font-semibold mb-2 flex items-center gap-2"><Brain size={16}/> The Nostalgia Spike</h4>
                <p className="text-sm text-slate-400">Sending a casual, non-demanding message referencing a specific positive shared memory. This bypasses defense mechanisms and lights up the brain's reward center.</p>
              </div>
              <div className="bg-slate-800 p-4 rounded-xl">
                <h4 className="text-white font-semibold mb-2 flex items-center gap-2"><Lock size={16}/> Safety Validation</h4>
                <p className="text-sm text-slate-400">Demonstrating that you have accepted the breakup. This removes the "pressure" they feel, making it safe for them to reach out without fear of being dragged back into drama.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Note */}
        <div className="p-6 border border-dashed border-slate-700 rounded-xl text-center">
          <p className="text-slate-400 text-sm">
            Ask Orion in the <span className="text-indigo-400 font-semibold cursor-pointer">Mentor Chat</span> for specific examples of how to apply these principles to your unique situation.
          </p>
        </div>

      </div>
    </div>
  );
};

export default GuideView;