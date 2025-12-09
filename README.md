<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1FQL5--RYSQQZqEGTKaEdOpQbbyqkBBn9

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set up environment variables in `.env`:

   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   GROK_API_KEY=your_grok_api_key_here
   GROQ_API_KEY=your_groq_api_key_here
   OPENAI_API_KEY=your_openai_api_key_here
   DEEPSEEK_API_KEY=your_deepseek_api_key_here
   LAOZANG_API_KEY=your_laozang_api_key_here
   DATABASE_URL=mongodb+srv://user:password@cluster.mongodb.net/orionai?appName=OrionIA
   JWT_SECRET=your-secret-key-change-in-production
   SITE_URL=https://your-site.vercel.app
   DIGISTORE_IPN_PASSPHRASE=your_digistore_ipn_passphrase
   ```

3. Generate Prisma Client:

   ```bash
   npm run db:generate
   ```

4. Push database schema:

   ```bash
   npm run db:push
   ```

5. Run the app:

   ```bash
   npm run dev
   ```

   This will start both the Express server (port 8888) and Vite dev server (port 3000) locally.
   All API routes will be available at `http://localhost:8888/api/`

## Authentication

The app requires user authentication. Users must:

- Register with name, email, and password
- Sign in to access the chat interface
- All routes are protected and require authentication

## Database

- MongoDB with Prisma ORM
- User model with: name, email, password, role, isBlocked, credits
- Conversation model for chat history
- JWT-based authentication
- Credit system: users start with 10 credits, each message costs 1 credit

## Deployment (Vercel)

1. Set environment variables in Vercel:

   - `GEMINI_API_KEY` - Your Gemini API key (primary AI provider)
   - `GROK_API_KEY` - Your Grok (xAI) API key (fallback AI provider)
   - `GROQ_API_KEY` - Your Groq API key (fallback AI provider)
   - `OPENAI_API_KEY` - Your OpenAI API key (fallback AI provider)
   - `DEEPSEEK_API_KEY` - Your Deep Seek API key (fallback AI provider)
   - `LAOZANG_API_KEY` - Your Laozang API key (fallback AI provider)
   - `DATABASE_URL` - MongoDB connection string (must include database name)
   - `JWT_SECRET` - Secret key for JWT tokens
   - `SITE_URL` - Your site URL (e.g., https://your-site.vercel.app)
   - `DIGISTORE_IPN_PASSPHRASE` - IPN passphrase from DigiStore settings (optional, for signature validation)

## AI Providers & Fallback System

The app includes a robust fallback system for AI providers to ensure high availability:

- **Primary**: Gemini (Google) - Used first if available
- **Fallback 1**: Grok (xAI) - Automatically used if Gemini fails or exceeds limits
- **Fallback 2**: Groq - Automatically used if previous providers fail
- **Fallback 3**: OpenAI - Automatically used if previous providers fail
- **Fallback 4**: Deep Seek - Automatically used if previous providers fail
- **Fallback 5**: Laozang - Automatically used if previous providers fail

The system automatically tries providers in sequence until one succeeds, ensuring the service never goes down due to API limits or failures.

2. The app will automatically deploy on push to main branch

## DigiStore IPN Integration

The app includes integration with DigiStore24 for automatic user creation when payments are confirmed.

### Configuration

1. Set up the IPN URL in DigiStore24 settings:

   - Go to https://www.digistore24.com/settings/ipn
   - Set the notify URL to: `https://your-site.vercel.app/api/digistore-ipn`
   - Configure IPN timing to "Before redirect to thankyou page"
   - Set "group by upsells" to NO (important for access data to be sent via email)

2. Set environment variables:
   - `SITE_URL` - Your site URL (e.g., https://your-site.vercel.app)
   - `DIGISTORE_IPN_PASSPHRASE` - IPN passphrase from DigiStore settings (optional, for signature validation)

### How it works

When a payment is confirmed:

- A new user account is automatically created with the email and name from DigiStore
- A random password is generated and the user is marked as active
- The user is required to change their password on first login (`passwordResetRequired: true`)
- Access credentials (email and temporary password) are sent to the customer via DigiStore's confirmation email
- The user is redirected to the login page

### Testing

You can test the IPN connection using DigiStore's connection test feature. The endpoint will respond with "OK" for connection tests.

## Important Notes

- **DATABASE_URL**: Must include the database name in the connection string
  - Format: `mongodb+srv://user:pass@cluster.mongodb.net/database_name?appName=AppName`
- **JWT_SECRET**: Use a strong, random secret in production
- **Development**: The app includes a local Express server that simulates Netlify Functions
  - Run `npm run dev` - starts both Express server (port 8888) and Vite (port 3000)
  - All functions work locally without needing `netlify dev`
  - In production, Netlify automatically uses the real Functions
- **Netlify CLI** (Optional): You can also use `netlify dev` if preferred

## Cloudflare Tunnel (Development)

For local development with external access and webhook support (e.g., DigiStore IPN), use Cloudflare Tunnel.

### Setup

1. Install Cloudflare Tunnel:

   - Download from: https://github.com/cloudflare/cloudflared/releases
   - Extract `cloudflared.exe` and add to PATH or place in project directory

2. **First time setup** - Configure the tunnel:

   ```bash
   setup-cloudflare-tunnel.bat
   ```

   This will:

   - Authenticate with Cloudflare (opens browser)
   - Create a named tunnel (`orion-ai-dev`)
   - Configure it to point to `localhost:3000`
   - Optionally set up a custom hostname

3. **Start the tunnel** (after setup):
   ```bash
   start-tunnel.bat
   ```
   Or use the combined script that starts both server and tunnel:
   ```bash
   start-with-tunnel.bat
   ```

### Scripts

- **`setup-cloudflare-tunnel.bat`** - One-time setup to create and configure the tunnel
- **`start-tunnel.bat`** - Start only the tunnel (server must be running separately)
- **`start-with-tunnel.bat`** - Start both server and tunnel together

### Usage for Webhooks

1. Run `setup-cloudflare-tunnel.bat` (first time only)
2. Start your development server: `npm run dev`
3. Start the tunnel: `start-tunnel.bat`
4. Copy the tunnel URL shown in the console
5. Use this URL in webhook configurations (e.g., DigiStore IPN):
   ```
   https://your-tunnel-url.trycloudflare.com/api/digistore-ipn
   ```

### Notes

- The tunnel URL is persistent (same URL each time) when using a named tunnel
- Quick tunnels generate random URLs each time (not recommended for webhooks)
- Press Ctrl+C to stop the tunnel
- The tunnel must be running to receive webhooks
