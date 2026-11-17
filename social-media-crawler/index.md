# Instagram single post

Navigate to `https://www.instagram.com/p/REPLACE_WITH_YOUR_ID/

```js
(async function exportInstagramComments() {
  // --- CONFIGURATION ---
  const FETCH_REPLIES = false; // Set to false if you only want top-level comments (much faster)
  const DELAY_MIN_MS = 1500; // Minimum delay between requests to prevent rate limits
  const DELAY_MAX_MS = 2500; // Maximum delay between requests
  // ---------------------

  const sleep = (min, max) => new Promise((r) => setTimeout(r, Math.floor(Math.random() * (max - min + 1)) + min));

  // 1. Extract shortcode from current URL
  const match = window.location.pathname.match(/\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  if (!match) {
    console.error("❌ Could not find a post/reel shortcode in the current URL.");
    return;
  }
  const shortcode = match[1];

  // 2. Convert Shortcode to Instagram Numeric Media ID (using BigInt)
  function shortcodeToMediaId(code) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let id = 0n;
    for (const char of code) {
      id = id * 64n + BigInt(alphabet.indexOf(char));
    }
    return id.toString();
  }

  const mediaId = shortcodeToMediaId(shortcode);
  console.log(`🔍 Post Shortcode: ${shortcode} | Numeric Media ID: ${mediaId}`);

  // Standard headers expected by Instagram's web API
  const csrfToken = document.cookie.match(/csrftoken=([^;]+)/)?.[1] || "";
  const headers = {
    "x-ig-app-id": "936619743392459", // Standard IG Web App ID
    "x-requested-with": "XMLHttpRequest",
    "x-csrftoken": csrfToken,
  };

  // Helper to fetch nested replies for a specific comment
  async function fetchChildComments(parentCommentId) {
    let replies = [];
    let minId = null;
    let hasMore = true;

    while (hasMore) {
      await sleep(DELAY_MIN_MS, DELAY_MAX_MS);
      const url = new URL(`https://www.instagram.com/api/v1/media/${mediaId}/comments/${parentCommentId}/child_comments/`);
      if (minId) url.searchParams.set("min_id", minId);

      const res = await fetch(url.toString(), { headers });
      if (!res.ok) {
        console.warn(`⚠️ Stopped fetching replies for ${parentCommentId} (HTTP ${res.status})`);
        break;
      }

      const data = await res.json();
      if (data.child_comments) {
        replies.push(...data.child_comments);
      }

      if (data.has_more_tail_child_comments && data.next_min_id) {
        minId = data.next_min_id;
      } else if (data.has_more_head_child_comments && data.next_max_id) {
        // Fallback depending on sort order
        minId = data.next_max_id;
      } else {
        hasMore = false;
      }
    }
    return replies;
  }

  // 3. Main loop to fetch top-level comments
  const allComments = [];
  let minId = null;
  let page = 1;

  console.log("🚀 Starting comment extraction... Please keep this tab open.");

  try {
    while (true) {
      const url = new URL(`https://www.instagram.com/api/v1/media/${mediaId}/comments/`);
      url.searchParams.set("can_support_threading", "true");
      url.searchParams.set("permalink_enabled", "false");
      if (minId) url.searchParams.set("min_id", minId);

      const res = await fetch(url.toString(), { headers });
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status} - You may be temporarily rate-limited.`);
      }

      const data = await res.json();
      const batch = data.comments || [];

      for (const comment of batch) {
        const formattedComment = {
          id: comment.pk,
          created_at_utc: comment.created_at_utc,
          created_at_iso: new Date(comment.created_at_utc * 1000).toISOString(),
          text: comment.text,
          like_count: comment.comment_like_count || 0,
          user: {
            id: comment.user?.pk,
            username: comment.user?.username,
            full_name: comment.user?.full_name,
            is_verified: comment.user?.is_verified,
            profile_pic_url: comment.user?.profile_pic_url,
          },
          reply_count: comment.child_comment_count || 0,
          replies: [],
        };

        // Handle replies if enabled and present
        if (FETCH_REPLIES && formattedComment.reply_count > 0) {
          const previewReplies = comment.preview_child_comments || [];

          // If IG already included all replies in the preview array, use them directly without extra network calls!
          if (previewReplies.length >= formattedComment.reply_count) {
            formattedComment.replies = previewReplies;
          } else {
            console.log(`   ↳ Fetching ${formattedComment.reply_count} replies for @${formattedComment.user.username}...`);
            const rawReplies = await fetchChildComments(comment.pk);
            formattedComment.replies = rawReplies;
          }

          // Clean up reply objects to match parent structure
          formattedComment.replies = formattedComment.replies.map((r) => ({
            id: r.pk,
            created_at_utc: r.created_at_utc,
            created_at_iso: new Date(r.created_at_utc * 1000).toISOString(),
            text: r.text,
            like_count: r.comment_like_count || 0,
            user: {
              id: r.user?.pk,
              username: r.user?.username,
              full_name: r.user?.full_name,
              is_verified: r.user?.is_verified,
            },
          }));
        }

        allComments.push(formattedComment);
      }

      console.log(`✅ Page ${page} fetched. Collected ${allComments.length} top-level comments so far...`);

      // Check pagination cursor
      if (data.next_min_id) {
        minId = data.next_min_id;
        page++;
        await sleep(DELAY_MIN_MS, DELAY_MAX_MS);
      } else {
        break;
      }
    }
  } catch (err) {
    console.error("⚠️ Extraction interrupted:", err.message);
    console.log("💾 Saving the comments collected so far...");
  }

  // 4. Download results as JSON
  const payload = {
    shortcode,
    media_id: mediaId,
    url: window.location.href,
    exported_at: new Date().toISOString(),
    top_level_comment_count: allComments.length,
    comments: allComments,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = `ig_comments_${shortcode}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);

  console.log(`🎉 Done! Downloaded ig_comments_${shortcode}.json`);
})();
```
