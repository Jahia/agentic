---
name: jahia-content-media-upload
description: Uploads images, documents, and other files to Jahia via MCP tools. Use when asked to ingest media, organize uploads in site folders, or reference files from content.
---

# Skill: jahia-content-media-upload

Uploads media into Jahia using MCP tools via the `jahia` MCP server.
Uploaded files land under `/sites/<siteKey>/files/` and can then be referenced from content.

> **Never call Jahia's GraphQL API directly.** Use only MCP tools. If a capability is missing, report it — do not work around with curl/GraphQL.

---

## Upload methods

### Method 1 — URL ingestion

If the file already exists at an HTTP or HTTPS URL:

```
tool: media.upload.url
args: {
  "siteKey": "SITE_KEY",
  "sourceUrl": "https://example.com/images/hero.jpg",
  "fileName": "hero.jpg"
}
```

Optional parameters:
- `folder`
- `mimeType`

Returns the file path, UUID, mime type, and size in bytes.

### Method 2 — Two-phase binary upload

Use this when the file is local or not publicly reachable.

Create the upload ticket:

```
tool: media.upload.create
args: {
  "siteKey": "SITE_KEY",
  "fileName": "report.pdf",
  "sizeBytes": 2048576,
  "folder": "documents"
}
```

This returns a `token` and `uploadUrl`.

Upload the raw bytes to `uploadUrl`, then finalize:

```
tool: media.upload.finalize
args: { "token": "UPLOAD_TOKEN" }
```

---

## Organize uploads in folders

```
tool: media.upload.url
args: {
  "siteKey": "SITE_KEY",
  "sourceUrl": "https://example.com/team-photo.jpg",
  "fileName": "team-photo.jpg",
  "folder": "images/team"
}
```

Folders are created automatically under `/sites/<siteKey>/files`.

---

## Reference uploaded media from content

After upload, use the returned UUID or path in the content type's reference property:

```
tool: content.create
args: {
  "parentPath": "/sites/SITE_KEY/home/about/main",
  "nodeType": "jdnt:imageBlock",
  "locale": "en",
  "properties": {
    "j:node": "UPLOADED_FILE_UUID",
    "jcr:title": "Team Photo"
  }
}
```

Common reference property names:
- `j:node`
- `image`

Use `content.list_definitions` or `content.type` to confirm the correct property name for the target type.

---

## Browse existing media

Media files are standard JCR nodes:

```
tool: content.list
args: {
  "parentPath": "/sites/SITE_KEY/files",
  "childNodeType": "jnt:file"
}
```

Or search for them:

```
tool: content.search
args: {
  "siteKey": "SITE_KEY",
  "nodeType": "jnt:file",
  "fullText": "hero"
}
```

---

## Common pattern — upload and publish an image for a page

```
# 1. Upload
tool: media.upload.url
args: {
  "siteKey": "SITE_KEY",
  "sourceUrl": "https://cdn.example.com/banner.jpg",
  "fileName": "banner.jpg",
  "folder": "images/banners"
}

# 2. Reference it from content
tool: content.create
args: {
  "parentPath": "/sites/SITE_KEY/home/landing/main",
  "nodeType": "jdnt:imageBlock",
  "locale": "en",
  "properties": {
    "j:node": "UPLOADED_FILE_UUID",
    "jcr:title": "Hero Banner"
  }
}

# 3. Publish both the media file and the page
tool: publication.publish
args: {
  "path": "/sites/SITE_KEY/files/images/banners/banner.jpg",
  "languages": ["en"]
}

tool: publication.publish
args: {
  "path": "/sites/SITE_KEY/home/landing",
  "languages": ["en"]
}
```

---

## Key rules

| Rule | Detail |
|------|--------|
| Files land in EDIT first | Uploads are not automatically live |
| Publish uploaded files when needed | Use `publication.publish` if public rendering depends on them |
| Max size depends on the upload method | Respect tool limits and server configuration |
| Folder paths are relative | Do not start `folder` with a leading slash |
| File names are plain file names | No path separators in `fileName` |

---

## Common errors

| Error | Cause | Fix |
|-------|-------|-----|
| `TICKET_NOT_FOUND` | Invalid or expired upload token | Create a new ticket with `media.upload.create` |
| `FILE_TOO_LARGE` | Payload exceeds the allowed size | Reduce file size or use the correct upload flow |
| `SOURCE_UNREACHABLE` | Jahia cannot fetch the source URL | Verify the remote URL from the Jahia server |
| `NODE_EXISTS` | A file with the same name already exists | Use a different `fileName` |

---

## Related skills

- `/jahia-content-create-content` — reference uploaded media from newly created content
- `/jahia-content-publish` — publish uploaded files and the pages that use them
- `/jahia-content-organize` — reorganize content after media-backed pages are created

