# WordPress Integration Guide

## Overview

This guide shows how to integrate the Centrum Rubáček Reservation System into your WordPress website.

## Integration Method: Iframe Embedding

The simplest and most reliable method for WordPress integration is using an iframe. This works even if you have only admin access (not site owner).

## Prerequisites

1. **Deployed Application**
   - The reservation system must be deployed and accessible via HTTPS
   - Example: `https://reservations.centrumrubacek.cz`

2. **WordPress Admin Access**
   - Access to edit pages/posts in WordPress
   - Ability to use HTML blocks or Code blocks

## Integration Steps

### Option 1: Using WordPress HTML Block (Recommended)

1. **Edit the target page** in WordPress (e.g., "Lekce a kroužky")

2. **Add a Custom HTML block**
   - Click the (+) button to add a new block
   - Search for "Custom HTML"
   - Click to add it

3. **Paste the iframe code**:
   ```html
   <iframe
       src="https://your-deployment-url.com"
       width="100%"
       height="800px"
       frameborder="0"
       style="border: none; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);"
       allow="clipboard-write"
       loading="lazy"
   ></iframe>
   ```

4. **Adjust the height** as needed (800px is a good starting point)

5. **Publish** the page

### Option 2: Using Shortcode

If your WordPress theme supports custom shortcodes, you can add this to your theme's `functions.php`:

```php
function centrum_rubacek_reservation_shortcode() {
    return '<iframe
        src="https://your-deployment-url.com"
        width="100%"
        height="800px"
        frameborder="0"
        style="border: none; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);"
        allow="clipboard-write"
        loading="lazy"
    ></iframe>';
}
add_shortcode('rezervace', 'centrum_rubacek_reservation_shortcode');
```

Then use `[rezervace]` in any page/post.

### Option 3: Page Builder (Elementor, Divi, etc.)

If using a page builder:

1. Add an **HTML widget** or **Code block**
2. Paste the iframe code above
3. Adjust styling using the page builder's tools

## Deployment Options

### Option A: Free Hosting (Vercel - Recommended)

1. **Create a GitHub repository** (if not already done)
   ```bash
   git remote add origin https://github.com/yourusername/reservation-system.git
   git push -u origin main
   ```

2. **Deploy to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "Import Project"
   - Connect your GitHub repository
   - Vercel will auto-detect the settings
   - Click "Deploy"

3. **Configure Environment Variables** (in Vercel dashboard)
   - `SESSION_SECRET`: Generate a random secret string
   - Any other environment variables

4. **Use the Vercel URL** in your iframe
   - Example: `https://reservation-system.vercel.app`

### Option B: Custom Domain

If you want `reservations.centrumrubacek.cz`:

1. Deploy to Vercel (as above)
2. In Vercel dashboard, go to Settings → Domains
3. Add `reservations.centrumrubacek.cz`
4. Update your DNS records as instructed by Vercel
   - Add CNAME record: `reservations` → `cname.vercel-dns.com`
5. Wait for DNS propagation (usually 5-30 minutes)

### Option C: Self-Hosting

If you have your own server:

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Deploy files to your server**
   - Upload all files to your server
   - Install Node.js on the server
   - Install dependencies: `npm install --production`

3. **Start the server**
   ```bash
   npm start
   ```

4. **Use a process manager** (PM2 recommended)
   ```bash
   npm install -g pm2
   pm2 start server.ts --name reservation-system
   pm2 save
   pm2 startup
   ```

5. **Configure reverse proxy** (nginx/Apache)
   - Point subdomain to the application port
   - Enable HTTPS with Let's Encrypt

## Styling Tips

### Make iframe responsive

```html
<div style="position: relative; padding-bottom: 800px; height: 0; overflow: hidden;">
    <iframe
        src="https://your-url.com"
        style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"
        frameborder="0"
        allow="clipboard-write"
    ></iframe>
</div>
```

### Auto-adjust height with JavaScript

Add this to your WordPress page (in Custom HTML block):

```html
<iframe
    id="rezervace-iframe"
    src="https://your-url.com"
    width="100%"
    frameborder="0"
    style="border: none;"
></iframe>

<script>
window.addEventListener('message', function(e) {
    if (e.origin === 'https://your-url.com') {
        document.getElementById('rezervace-iframe').style.height = e.data.height + 'px';
    }
});
</script>
```

## Testing Locally

To test the integration before deploying:

1. **Start the local server**
   ```bash
   npm start
   ```

2. **Use ngrok for temporary public URL**
   ```bash
   npx ngrok http 3000
   ```

3. **Use the ngrok URL** in your WordPress iframe
   - Example: `https://abc123.ngrok.io`

4. **Test on your WordPress site**
   - Add the iframe to a test page
   - Verify login works
   - Test all features

5. **Note**: ngrok URLs expire after session ends

## Security Considerations

1. **Always use HTTPS** in production
2. **Configure CORS** properly (see server.ts)
3. **Use secure cookies** (already configured)
4. **Keep SESSION_SECRET** secret and strong
5. **Regular updates** of dependencies

## Troubleshooting

### Issue: "Refused to display in a frame"

**Solution**: The app is already configured to allow iframe embedding with proper headers.

### Issue: Login doesn't work in iframe

**Solution**:
- Ensure cookies are enabled
- Use HTTPS (required for cross-site cookies)
- Check browser console for errors

### Issue: Styling looks broken

**Solution**:
- Clear browser cache
- Check iframe dimensions
- Verify CSS files are loading (check Network tab)

### Issue: Can't see the iframe

**Solution**:
- Check if the URL is correct
- Open the URL directly in a browser first
- Verify the server is running
- Check browser console for errors

## Support

For issues or questions:
- Check server logs: Look at server console output
- Browser console: Press F12 and check Console tab
- Test directly: Open the app URL without WordPress first

## Next Steps

1. Deploy the application (recommended: Vercel)
2. Get the public URL
3. Add iframe to WordPress page
4. Test thoroughly
5. Train users on the new system
6. Monitor for issues

---

**Ready to integrate!** Follow the steps above and your reservation system will be live on your WordPress site.
