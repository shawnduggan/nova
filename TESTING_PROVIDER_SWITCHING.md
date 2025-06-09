# Testing Provider Switching Feature

This guide covers how to test the new provider switching functionality that differentiates between Core (free) and SuperNova (paid) tiers.

## Setup

### 1. Build and Load the Plugin
```bash
cd "/Users/shawn/Library/Mobile Documents/iCloud~md~obsidian/Documents/Basecamp/.obsidian/plugins/nova"
npm run build
```

Then restart Obsidian or reload the plugin.

## Testing Core Tier (Static Display)

By default, you'll be on the Core tier and should see:

### Expected Behavior
- Open the Nova sidebar (click the ⭐ star icon in ribbon)
- Look at the header - you should see a **static provider status**
  - Shows current provider name with a green status dot
  - **No dropdown arrow** - just plain text display
  - No interactive elements for provider switching

### What This Demonstrates
- Core users have a simple, non-interactive provider display
- Provider switching is a SuperNova-only feature
- Clear visual distinction between tiers

## Testing SuperNova Tier (Provider Switching)

To test the full provider switching functionality, you need to upgrade to SuperNova tier:

### Option A: Use Debug Mode (Recommended for Testing)
1. Go to **Settings → Nova AI Settings**
2. Scroll to **"Development Settings"** section
3. Enable **"Debug Mode"** toggle
4. Set **"Override Tier"** dropdown to **"Force SuperNova Tier"**
5. Close settings and refresh the Nova sidebar

### Option B: Use Test License
1. Go to **Settings → Nova AI Settings**
2. In the **"License Key"** field, paste this test license:
   ```
   test@example.com|supernova|2025-12-31T23:59:59.999Z|2024-01-01T00:00:00.000Z|test_signature
   ```
3. Click **"Validate"** button
4. Should show "✅ Valid SuperNova license!"

## SuperNova Tier Features

### Expected UI Changes
When in SuperNova tier, the sidebar header should show:

- **Interactive provider dropdown button** (replaces static status)
- **Dropdown arrow (▼)** that rotates when clicked
- **Clickable provider button** with hover effects

### Provider Dropdown Functionality
1. **Click the provider dropdown button**
2. **Dropdown menu appears** with:
   - 🟤 **Claude** (brown dot)
   - 🟢 **OpenAI** (green dot)
   - 🔵 **Gemini** (blue dot)
   - 🟣 **Ollama** (purple dot)
3. **Current provider highlighted** in bold with background color
4. **Hover effects** on non-current providers

### Testing Provider Switching
1. **Select a different provider** from the dropdown
2. **System message appears** in chat: "🔄 Switched to [Provider Name]"
3. **Dropdown closes automatically**
4. **Header updates** to show new provider name
5. **Send a test message** to verify it uses the new provider

### Conversation Continuity
- Previous messages remain in chat
- System message provides clear feedback about the switch
- New messages use the selected provider
- Conversation context is preserved

## Mobile Testing

### Core Tier on Mobile
- Plugin should be **completely blocked**
- **Upgrade prompt modal** appears immediately
- No sidebar functionality available
- Clear messaging about mobile requiring SuperNova

### SuperNova Tier on Mobile
- **Full functionality** including provider switching
- Same dropdown interface as desktop
- All features work normally

## Settings Integration

### Verify Settings Persistence
1. Switch providers using the sidebar dropdown
2. Go to **Settings → Nova AI Settings → Platform Settings**
3. Check **"Primary Provider"** for Desktop
4. Should match your selected provider from the dropdown
5. Settings should persist across Obsidian restarts

### Provider Restrictions (Core Tier)
1. Switch back to Core tier (disable debug mode)
2. Go to **Settings → Provider Settings**
3. Should see **"SuperNova Only"** badges on restricted providers
4. Only 1 local + 1 cloud provider should be configurable

## Visual Verification Checklist

### Core Tier Sidebar
- [ ] Static provider status (text only)
- [ ] No dropdown arrow
- [ ] No clickable elements
- [ ] Green status dot visible

### SuperNova Tier Sidebar
- [ ] Interactive dropdown button
- [ ] Dropdown arrow (▼) visible
- [ ] Button has hover effects
- [ ] Dropdown menu opens/closes properly
- [ ] Provider colors display correctly
- [ ] Current provider highlighted
- [ ] System messages appear on switch

### Mobile Behavior
- [ ] Core tier: Complete plugin blocking
- [ ] Core tier: Upgrade modal appears
- [ ] SuperNova tier: Full functionality
- [ ] SuperNova tier: Provider switching works

## Error Scenarios

### Test Error Handling
1. Switch to a provider with invalid configuration
2. Should see error message: "❌ Failed to switch to [Provider]"
3. Previous provider should remain active
4. Chat should continue functioning

### Cleanup Testing
1. Close and reopen the sidebar multiple times
2. Switch between different files
3. Verify no memory leaks or stuck event listeners
4. Provider state should persist correctly

## Feature Flag Verification

### Debug Console Testing
Open browser developer tools and check:
```javascript
// In Obsidian's console
app.plugins.plugins.nova.featureManager.isFeatureEnabled('provider_switching')
// Should return false for Core, true for SuperNova
```

## Troubleshooting

### If Provider Switching Doesn't Appear
1. Verify you're in SuperNova tier (check settings)
2. Refresh the sidebar (close/reopen)
3. Check browser console for errors
4. Verify debug mode is enabled correctly

### If Switching Fails
1. Check provider configurations in settings
2. Verify API keys are set for target provider
3. Look for error messages in chat
4. Check browser console for detailed errors

### If UI Looks Wrong
1. Clear Obsidian cache and restart
2. Rebuild the plugin with `npm run build`
3. Check if custom CSS themes are interfering
4. Verify all files were updated correctly

## Success Criteria

The feature is working correctly when:
- ✅ Core users see static provider display only
- ✅ SuperNova users see interactive dropdown
- ✅ Provider switching works with system messages
- ✅ Settings persist across sessions
- ✅ Mobile blocking works for Core tier
- ✅ No JavaScript errors in console
- ✅ UI is visually consistent and polished