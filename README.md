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

2. The app will automatically deploy on push to main branch

## Important Notes

- **DATABASE_URL**: Must include the database name in the connection string
  - Format: `mongodb+srv://user:pass@cluster.mongodb.net/database_name?appName=AppName`
- **JWT_SECRET**: Use a strong, random secret in production
- **Development**: The app includes a local Express server that simulates Netlify Functions
  - Run `npm run dev` - starts both Express server (port 8888) and Vite (port 3000)
  - All functions work locally without needing `netlify dev`
  - In production, Netlify automatically uses the real Functions
- **Netlify CLI** (Optional): You can also use `netlify dev` if preferred
