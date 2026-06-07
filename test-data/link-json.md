## Editing `links.json`

The Static JSON Version stores all data inside:

```text
public/data/links.json
```

Example:

```json
[
  {
    "keyword": "camera",
    "created_at": "2026-05-15T10:00:00Z",
    "links": [
      {
        "label": "Sony ZV-E10",
        "url": "https://example.com"
      },
      {
        "label": "Lens Guide",
        "url": "https://example.com"
      }
    ]
  }
]
```

### Adding a New Keyword Card

Copy an existing card, paste it after the previous one, and edit the values.

Example:

```json
[
  {
    "keyword": "camera",
    "created_at": "2026-05-15T10:00:00Z",
    "links": [
      {
        "label": "Sony ZV-E10",
        "url": "https://example.com"
      }
    ]
  },
  {
    "keyword": "linux",
    "created_at": "2026-05-15T10:01:00Z",
    "links": [
      {
        "label": "Arch Linux",
        "url": "https://archlinux.org"
      }
    ]
  }
]
```

**Important:**
- Separate each card with a comma `,`
- Do not remove the opening `[` or closing `]`
- Do not leave a comma after the last card

### Adding More Links to a Card

Copy an existing link object and paste it inside the card's `links` array.

Example:

```json
{
  "label": "Sony ZV-E10",
  "url": "https://example.com"
}
```

**Important:**
- Separate links with a comma `,`
- Do not leave a comma after the last link

If you're new to JSON, watching a short YouTube tutorial about JSON syntax is recommended before editing the file.

### Editing the Date

Each card contains a `created_at` field:

```json
"created_at": "2026-05-15T10:00:00Z"
```

This date is used to sort cards and determine which cards appear in the "Latest Keywords" section.

When creating a new card, update the date and time accordingly.

Example:

```json
"created_at": "2026-06-03T14:30:00Z"
```

Format:

```text
YYYY-MM-DDTHH:MM:SSZ
```

Example:

```text
2026-06-03T14:30:00Z
```

If you don't care about exact times, simply copy the date from another card and change it to a newer date.

Newer dates appear before older dates.
