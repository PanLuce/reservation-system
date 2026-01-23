# Local Testing Guide

## Testing Locally (Without WordPress)

### Quick Start

1. **Start the server**:
   ```bash
   npx tsx server.ts
   ```
   Server will run at `http://localhost:3000`

2. **Open test iframe page**:
   ```bash
   open test-iframe.html
   ```
   Or manually open `test-iframe.html` in your browser.

3. **Test the integration**:
   - Login with: `admin@centrumrubacek.cz` / `admin123`
   - Verify all features work inside the iframe
   - Check that styling looks correct

### What to Verify

- ✅ Login works in iframe
- ✅ Session persists across page navigation
- ✅ All lessons display correctly
- ✅ Registration form works
- ✅ Admin features accessible
- ✅ No console errors (press F12)

---

## Testing with WordPress (Using ngrok)

If you want to test the actual WordPress integration before deploying to production, use ngrok to create a temporary public URL.

### Prerequisites

- Server running locally (`npx tsx server.ts`)
- ngrok installed (or use npx)

### Step 1: Create Public URL with ngrok

```bash
npx ngrok http 3000
```

You'll see output like:
```
Forwarding    https://abc123.ngrok-free.app -> http://localhost:3000
```

**Copy the HTTPS URL** (e.g., `https://abc123.ngrok-free.app`)

### Step 2: Update WordPress Page

1. **Login to WordPress admin panel**
   - Go to `https://centrumrubacek.cz/wp-admin`

2. **Edit the target page** (e.g., "Lekce a kroužky")

3. **Add Custom HTML block**:
   ```html
   <iframe
       src="https://abc123.ngrok-free.app"
       width="100%"
       height="800px"
       frameborder="0"
       style="border: none; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);"
       allow="clipboard-write"
       loading="lazy"
   ></iframe>
   ```

4. **Preview or Publish** the page

5. **Test all features**:
   - Login
   - Registration
   - Admin functions
   - Check browser console for errors

### Step 3: Environment Variables for Testing

Create `.env` file (optional for local testing):

```bash
NODE_ENV=development
SESSION_SECRET=test-secret-for-local-development
ALLOWED_ORIGINS=https://centrumrubacek.cz,https://www.centrumrubacek.cz
PORT=3000
```

Restart server to apply:
```bash
npx tsx server.ts
```

### Important Notes

- ⚠️ **ngrok URLs expire** when you close the terminal or after 2 hours (free tier)
- ⚠️ **Don't use ngrok for production** - deploy to Vercel instead
- ✅ **HTTPS is required** for WordPress integration (cookies won't work with HTTP)
- ✅ **ngrok provides HTTPS** automatically

### Troubleshooting

#### Issue: "Refused to display in a frame"
**Solution**: Server already configured to allow iframe embedding. Check server logs.

#### Issue: Login doesn't work
**Solution**:
- Ensure using HTTPS ngrok URL (not HTTP)
- Check browser console for cookie errors
- Verify session secret is set

#### Issue: CORS errors in console
**Solution**:
- Check `ALLOWED_ORIGINS` includes WordPress domain
- Verify WordPress URL matches exactly (with/without www)

#### Issue: ngrok "Visit Site" button required
**Solution**:
- ngrok free tier shows warning page on first visit
- Click "Visit Site" button to proceed
- Consider ngrok paid plan to remove this

---

## Alternative: Local WordPress with Docker

If you want to test with a local WordPress installation:

### Step 1: Start Local WordPress

```bash
docker run -d \
  --name wp-test \
  -p 8080:80 \
  -e WORDPRESS_DB_HOST=db \
  -e WORDPRESS_DB_USER=wordpress \
  -e WORDPRESS_DB_PASSWORD=wordpress \
  wordpress:latest
```

### Step 2: Access WordPress
- Visit `http://localhost:8080`
- Complete WordPress installation

### Step 3: Use iframe with localhost
```html
<iframe
    src="http://localhost:3000"
    width="100%"
    height="800px"
    frameborder="0"
></iframe>
```

**Note**: This won't test cross-site cookies properly (both on localhost).

---

## Testing Checklist

Before deploying to production, verify:

- [ ] iframe displays correctly in WordPress
- [ ] Login functionality works
- [ ] Registration saves correctly
- [ ] Admin can create/edit lessons
- [ ] No console errors
- [ ] Mobile responsive
- [ ] Session persists across page reloads
- [ ] Logout works correctly
- [ ] All forms submit successfully
- [ ] Error messages display properly

---

## Next Steps

Once local testing is complete:

1. ✅ Commit all changes
2. 🚀 Deploy to Vercel (see DEPLOYMENT.md)
3. 🔗 Update WordPress with production URL
4. 📊 Monitor for issues
5. 👥 Train users on new system

---

## Support

**Issue?** Check:
1. Server logs (terminal where `npx tsx server.ts` runs)
2. Browser console (F12 → Console tab)
3. Network tab (F12 → Network tab)
4. ngrok status page

**Common Fixes:**
- Restart server: `Ctrl+C` then `npx tsx server.ts`
- Clear browser cache: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
- Check ngrok is still running: Look for "Session Status: online"
