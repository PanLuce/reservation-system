# Deployment Guide

## Quick Deploy to Vercel (Recommended - FREE!)

Vercel offers free hosting perfect for this application.

### Prerequisites
- GitHub account
- Vercel account (free, sign up at [vercel.com](https://vercel.com))

### Step 1: Push to GitHub

If you haven't already:

```bash
# Initialize git repository (if not done)
git init

# Add remote repository
git remote add origin https://github.com/YOUR_USERNAME/reservation-system.git

# Push code
git add -A
git commit -m "Prepare for deployment"
git push -u origin main
```

### Step 2: Deploy to Vercel

1. **Go to [vercel.com](https://vercel.com)** and sign in
2. **Click "Add New Project"**
3. **Import your GitHub repository**
   - Connect your GitHub account if not already connected
   - Select the `reservation-system` repository
   - Click "Import"

4. **Configure Build Settings** (Vercel should auto-detect these)
   - Framework Preset: Other
   - Build Command: `npm run build` (or leave empty)
   - Output Directory: `.` (current directory)
   - Install Command: `npm install`

5. **Add Environment Variables**
   Click "Environment Variables" and add:

   ```
   NODE_ENV = production
   SESSION_SECRET = [generate random string]
   ALLOWED_ORIGINS = https://centrumrubacek.cz,https://www.centrumrubacek.cz
   ```

   To generate SESSION_SECRET:
   ```bash
   openssl rand -base64 32
   ```
   Or use: https://randomkeygen.com/

6. **Click "Deploy"**

7. **Wait for deployment** (usually 1-2 minutes)

8. **Get your URL**
   - Will be something like: `https://reservation-system-abc123.vercel.app`
   - This is your production URL!

### Step 3: Configure Custom Domain (Optional)

If you want `reservations.centrumrubacek.cz`:

1. **In Vercel Dashboard**
   - Go to Project Settings
   - Click "Domains"
   - Add `reservations.centrumrubacek.cz`

2. **Update DNS** (at your domain registrar)
   - Add CNAME record:
     - Name: `reservations`
     - Value: `cname.vercel-dns.com`
   - TTL: 3600 (or default)

3. **Wait for DNS propagation** (5-30 minutes)

4. **Vercel will automatically provision SSL certificate**

### Step 4: Test Your Deployment

1. Open your Vercel URL in a browser
2. Should see the login page
3. Login with admin@centrumrubacek.cz / admin123
4. Test creating a lesson
5. Test registration

### Step 5: Update WordPress

1. Go to your WordPress admin panel
2. Edit the page where you want the reservation system
3. Add Custom HTML block
4. Paste:

```html
<iframe
    src="https://YOUR-VERCEL-URL.vercel.app"
    width="100%"
    height="800px"
    frameborder="0"
    style="border: none; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);"
    allow="clipboard-write"
    loading="lazy"
></iframe>
```

Replace `YOUR-VERCEL-URL.vercel.app` with your actual Vercel URL.

5. **Publish** the page
6. **Test** - Visit the page and verify everything works!

## Automatic Deployments

Vercel automatically redeploys when you push to GitHub:

```bash
# Make changes
git add -A
git commit -m "Update feature"
git push

# Vercel automatically deploys!
```

You'll get a notification when deployment is complete.

## Monitoring

- **Vercel Dashboard**: See deployment logs, errors, analytics
- **Email Notifications**: Get notified of failed deployments
- **Logs**: Check server logs in Vercel dashboard

## Troubleshooting

### Issue: "Cannot find module"
**Solution**: Ensure all dependencies are in `package.json`

### Issue: Database resets on each deployment
**Solution**: This is expected with SQLite. For production, consider:
- Using Vercel Postgres (free tier available)
- Or keep SQLite (data resets are fine for development)

### Issue: CORS errors
**Solution**:
- Check ALLOWED_ORIGINS environment variable
- Ensure it includes your WordPress domain
- Redeploy after changing

### Issue: Login doesn't work
**Solution**:
- Ensure SESSION_SECRET is set
- Check that cookies are enabled
- Verify HTTPS is working

## Alternative: Railway.app

If you prefer Railway:

1. Go to [railway.app](https://railway.app)
2. Click "Start a New Project"
3. Choose "Deploy from GitHub"
4. Select your repository
5. Add environment variables (same as Vercel)
6. Deploy!

## Alternative: Render.com

1. Go to [render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Connect GitHub repository
4. Configure:
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Add environment variables
6. Deploy!

---

**That's it!** Your reservation system is now live and can be embedded in WordPress.

## Support

Having issues? Check:
- Vercel deployment logs
- Browser console (F12)
- Server logs in Vercel dashboard
- Test the URL directly (outside iframe) first
