---
name: Mobile scrolling intent
description: Scope of the native-feeling mobile scroll restriction.
---

Keep the feed and outer document stationary, but allow internal scrolling for long content and overlays.

**Why:** The request for a native-feeling mobile UI addressed extra space and page movement beneath the feed. Applying a blanket touch-event cancellation would also prevent reading the introduction, settings, and post discussions.

**How to apply:** When changing viewport or gesture handling, verify both a stationary feed and usable scrolling in long screens and dialogs. Preserve safe-area space for the iPhone home indicator rather than treating it as unwanted overflow.