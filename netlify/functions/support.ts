import { Handler } from '@netlify/functions';

const SUPPORT_EMAIL = 'gmrelationship@gmail.com';

// Função para enviar e-mail via SendGrid API
const sendEmailViaSendGrid = async (
  to: string,
  subject: string,
  html: string,
  text: string
) => {
  const apiKey = process.env.SENDGRID_API_KEY;
  
  if (!apiKey) {
    throw new Error('SENDGRID_API_KEY not configured');
  }

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: to }],
          subject: subject,
        },
      ],
      from: {
        email: process.env.SENDGRID_FROM_EMAIL || 'noreply@orionai.com',
        name: 'Orion AI Support',
      },
      content: [
        {
          type: 'text/plain',
          value: text,
        },
        {
          type: 'text/html',
          value: html,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SendGrid API error: ${response.status} - ${errorText}`);
  }

  return response;
};

export const handler: Handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { subject, message, userEmail, userName } = JSON.parse(event.body || '{}');

    // Validação
    if (!subject || !message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Subject and message are required' }),
      };
    }

    // Preparar conteúdo do e-mail
    const emailSubject = `[Orion AI Support] ${subject}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
        <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h2 style="color: #6366f1; margin-top: 0;">New Support Request</h2>
          
          <div style="margin: 20px 0; padding: 15px; background-color: #f9fafb; border-left: 4px solid #6366f1; border-radius: 4px;">
            <p style="margin: 5px 0;"><strong>From:</strong> ${userName || 'Unknown'} (${userEmail || 'No email provided'})</p>
            <p style="margin: 5px 0;"><strong>Subject:</strong> ${subject}</p>
          </div>
          
          <div style="margin: 20px 0;">
            <h3 style="color: #374151; margin-bottom: 10px;">Message:</h3>
            <div style="padding: 15px; background-color: #f9fafb; border-radius: 4px; white-space: pre-wrap; color: #374151;">
              ${message.replace(/\n/g, '<br>')}
            </div>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
            <p>This message was sent from the Orion AI Support form.</p>
            <p>User Email: ${userEmail || 'Not provided'}</p>
          </div>
        </div>
      </div>
    `;
    
    const emailText = `
New Support Request

From: ${userName || 'Unknown'} (${userEmail || 'No email provided'})
Subject: ${subject}

Message:
${message}

---
This message was sent from the Orion AI Support form.
User Email: ${userEmail || 'Not provided'}
    `.trim();

    // Enviar e-mail via SendGrid
    await sendEmailViaSendGrid(
      SUPPORT_EMAIL,
      emailSubject,
      emailHtml,
      emailText
    );

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        success: true,
        message: 'Support request sent successfully' 
      }),
    };
  } catch (error: any) {
    console.error('Support email error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message || 'Failed to send support request' 
      }),
    };
  }
};
