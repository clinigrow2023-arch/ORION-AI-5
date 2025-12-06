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
   DATABASE_URL=mongodb+srv://user:password@cluster.mongodb.net/orionai?appName=OrionIA
   JWT_SECRET=your-secret-key-change-in-production
   SITE_URL=https://your-site.netlify.app
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

   **Option 1: Development with Netlify Functions (Recommended)**

   ```bash
   netlify dev
   ```

   This will start both the Vite dev server and Netlify Functions locally.

   **Option 2: Vite only (Functions won't work)**

   ```bash
   npm run dev
   ```

   Note: Authentication and other Netlify Functions won't work with this option. Use `netlify dev` instead.

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

## Deployment (Netlify)

1. Set environment variables in Netlify:

   - `GEMINI_API_KEY` - Your Gemini API key
   - `DATABASE_URL` - MongoDB connection string (must include database name)
   - `JWT_SECRET` - Secret key for JWT tokens
   - `SITE_URL` - Your site URL (e.g., https://your-site.netlify.app)
   - `DIGISTORE_IPN_PASSPHRASE` - IPN passphrase from DigiStore settings (optional, for signature validation)

2. The app will automatically deploy on push to main branch

## DigiStore IPN Integration

The app includes integration with DigiStore24 for automatic user creation when payments are confirmed.

### Configuration

1. Set up the IPN URL in DigiStore24 settings:

   - Go to https://www.digistore24.com/settings/ipn
   - Set the notify URL to: `https://your-site.netlify.app/.netlify/functions/digistore-ipn`
   - Configure IPN timing to "Before redirect to thankyou page"
   - Set "group by upsells" to NO (important for access data to be sent via email)

2. Set environment variables:
   - `SITE_URL` - Your site URL (e.g., https://your-site.netlify.app)
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

For local development with external access, you can use Cloudflare Tunnel.

### Setup

1. Install Cloudflare Tunnel:
   - Download from: https://github.com/cloudflare/cloudflared/releases
   - Extract `cloudflared.exe` and add to PATH or place in project directory

2. Run the script:
   ```bash
   start-with-tunnel.bat
   ```

### Options

The script offers three tunnel options:

1. **Named Tunnel** - Use an existing configured tunnel (requires prior setup)
2. **Quick Tunnel** (Default) - Creates a temporary tunnel with a random URL (recommended for development)
3. **Custom Hostname** - Use a custom hostname (requires prior configuration)

### Usage

- The script will start the development server in a separate window
- The Cloudflare Tunnel URL will be displayed in the console
- Use this URL to access your local server from anywhere
- Press Ctrl+C to stop the tunnel (server will continue running in the other window)
