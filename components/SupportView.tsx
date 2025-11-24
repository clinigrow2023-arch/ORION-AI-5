import React, { useState } from 'react';
import { Mail, Send, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const SupportView: React.FC = () => {
  const { user } = useAuth();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subject.trim() || !message.trim()) {
      setSubmitStatus('error');
      setErrorMessage('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch('/.netlify/functions/support', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          subject: subject.trim(),
          message: message.trim(),
          userEmail: user?.email || '',
          userName: user?.name || '',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      setSubmitStatus('success');
      setSubject('');
      setMessage('');
      
      // Reset success message after 5 seconds
      setTimeout(() => {
        setSubmitStatus('idle');
      }, 5000);
    } catch (error: any) {
      setSubmitStatus('error');
      setErrorMessage(error.message || 'An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-full mb-4">
            <Mail className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Contact Support</h2>
          <p className="text-slate-400">
            We're here to help! Send us a message and we'll get back to you as soon as possible.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-slate-300 mb-2">
              Subject
            </label>
            <input
              type="text"
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="What can we help you with?"
              disabled={isSubmitting}
              required
            />
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-medium text-slate-300 mb-2">
              Message
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
              placeholder="Please describe your issue or question in detail..."
              disabled={isSubmitting}
              required
            />
          </div>

          {submitStatus === 'success' && (
            <div className="flex items-center gap-3 p-4 bg-green-900/20 border border-green-700 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
              <p className="text-green-400 text-sm">
                Message sent successfully! We'll get back to you soon.
              </p>
            </div>
          )}

          {submitStatus === 'error' && (
            <div className="flex items-center gap-3 p-4 bg-red-900/20 border border-red-700 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm">
                {errorMessage || 'Failed to send message. Please try again.'}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !subject.trim() || !message.trim()}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Sending...</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>Send Message</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-8 p-4 bg-slate-900/50 border border-slate-800 rounded-lg">
          <p className="text-xs text-slate-400 text-center">
            Your message will be sent to our support team. We typically respond within 24-48 hours.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SupportView;

