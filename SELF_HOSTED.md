# Self-Hosted Supabase Setup

Self-hosted Supabase gives you full control over your data with no external dependencies.

## Requirements

- Docker & Docker Compose
- 4GB+ RAM recommended
- Ports 3001, 5432, 8000 available

## Quick Start

### 1. Start Supabase

```bash
# Start all services
docker-compose -f docker-compose.supabase.yml up -d

# Check status
docker-compose -f docker-compose.supabase.yml ps
```

### 2. Access Services

| Service | URL |
|---------|-----|
| Studio UI | http://localhost:3001 |
| API Gateway | http://localhost:8000 |
| PostgreSQL | localhost:5432 |

### 3. Run Database Schema

1. Open Studio at http://localhost:3001
2. Go to SQL Editor
3. Run the contents of `supabase/schema.sql`

### 4. Configure App

Update `.env`:
```env
NEXT_PUBLIC_BACKEND=supabase
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
```

### 5. Update API Routes

Change your fetch calls to use Supabase endpoints:
```typescript
// In your pages, change:
fetch('/api/accounts')
// To:
fetch('/api/supabase/accounts')
```

## Security (Production)

Before deploying to production, generate new keys:

```bash
# Generate JWT secret (32+ chars)
openssl rand -base64 32

# Generate anon/service keys
# Use https://jwt.io with your secret
```

Update these in `docker-compose.supabase.yml`:
- `POSTGRES_PASSWORD`
- `JWT_SECRET` (all services)
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`

## Services Included

| Service | Port | Purpose |
|---------|------|---------|
| Studio | 3001 | Admin dashboard |
| Kong | 8000 | API gateway |
| PostgreSQL | 5432 | Database |
| GoTrue | - | Authentication |
| PostgREST | - | REST API |
| Realtime | - | WebSockets |
| Storage | - | File uploads |

## Stop Services

```bash
docker-compose -f docker-compose.supabase.yml down

# Remove data volumes
docker-compose -f docker-compose.supabase.yml down -v
```

## Production Deployment

For production, consider:

1. **Reverse Proxy** (nginx/traefik) with SSL
2. **Backups** - Configure PostgreSQL backups
3. **Monitoring** - Add Prometheus/Grafana
4. **Resource Limits** - Add CPU/memory limits to compose

Example with nginx:
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
    }
    
    location /studio {
        proxy_pass http://localhost:3001;
    }
}
```
