cjp-auth-server

Setup
1) Copy .env.example to .env and set MONGO_URI (do not commit secrets), DB_NAME, JWT_SECRET, PORT.
2) Install dependencies:
   npm install
3) Run locally:
   npm run dev

Security
- MongoDB Atlas provides encryption at rest and TLS in transit to the database by default for mongodb+srv URIs.
- Ensure your API is served over HTTPS in production (use a reverse proxy or a platform that terminates TLS).
- JWT secret must be long and random. Rotate if leaked.
- Use strong bcrypt cost; default here is 12.
